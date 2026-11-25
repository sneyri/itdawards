import assert from 'node:assert/strict';
import { fork, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Pool } from 'pg';
import sharp from 'sharp';
import { migrate } from '../../database/migrate.js';

const databaseUrl = process.env.ITD_TEST_DATABASE_URL;
const serverDirectory = fileURLToPath(new URL('../../', import.meta.url));
const digest = (body) => createHash('sha256').update(body).digest('hex');

function wav(samples) {
    const bytes = Buffer.alloc(44 + samples * 2);
    bytes.write('RIFF');
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(1, 20);
    bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(8000, 24);
    bytes.writeUInt32LE(16000, 28);
    bytes.writeUInt16LE(2, 32);
    bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36);
    bytes.writeUInt32LE(samples * 2, 40);
    for (let sample = 0; sample < samples; sample++) bytes.writeInt16LE(sample % 256, 44 + sample * 2);
    return bytes;
}

async function startApp(env, config = {}) {
    const child = fork('server.js', [], {
        cwd: serverDirectory, env: { ...env, ...config }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    async function stop() {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const closed = once(child, 'exit');
        child.kill();
        await closed;
    }
    try {
        const [{ port }] = await once(child, 'message', { signal: AbortSignal.timeout(10_000) });
        return { origin: 'http://127.0.0.1:' + port, stop };
    } catch (error) {
        await stop();
        throw error;
    }
}

async function runTransfer(env, ...args) {
    const child = spawn(process.execPath, ['database/transfer_media.js', ...args], {
        cwd: serverDirectory, env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let errors = '';
    child.stdout.setEncoding('utf8').on('data', (data) => { output += data; });
    child.stderr.setEncoding('utf8').on('data', (data) => { errors += data; });
    const [code] = await once(child, 'close');
    assert.equal(errors, '');
    return { code, report: JSON.parse(output) };
}

async function expectRange(origin, link, bytes, start, end, range = `bytes=${start}-${end}`) {
    const result = await fetch(origin + link, { headers: { Range: range } });
    assert.equal(result.status, 206);
    assert.equal(result.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
    assert.equal(Number(result.headers.get('content-length')), end - start + 1);
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes.subarray(start, end + 1));
}

test('media HTTP, migration, cache and restoration with PostgreSQL and a temporary media directory',
    { skip: !databaseUrl, timeout: 60_000 }, async (t) => {
        const database = new URL(databaseUrl);
        assert.equal(database.hostname, '127.0.0.1');
        assert.match(database.pathname, /_test$/);
        const schema = 'media_test_' + randomUUID().replaceAll('-', '');
        const sandbox = await mkdtemp(join(tmpdir(), 'itd-media-test-'));
        const root = join(sandbox, 'media');
        const admin = new Pool({ connectionString: databaseUrl });
        const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
        let running;
        t.after(async () => {
            await running?.stop();
            await pool.end();
            try {
                await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
            } finally {
                await admin.end();
                await rm(sandbox, { recursive: true, force: true });
            }
        });
        await admin.query(`CREATE SCHEMA "${schema}"`);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await migrate(client);
            await client.query('COMMIT');
        } finally {
            client.release();
        }

        const env = {
            ...process.env, NODE_ENV: 'test', PUBLIC_ORIGIN: '', CORS_ORIGINS: '', PORT: '0',
            TELEGRAM_BOT_USERNAME: '', BOT_API_TOKEN: '', AUTH_CODE_SECRET: '',
            DB_HOST: database.hostname, DB_PORT: database.port || '5432', DB_NAME: database.pathname.slice(1),
            DB_USER: decodeURIComponent(database.username), DB_PASSWORD: decodeURIComponent(database.password),
            PGOPTIONS: `-c search_path=${schema}`, MEDIA_STORAGE_DIR: root, MEDIA_FILE_ONLY: '0', MEDIA_NGINX_ACCEL: '0',
        };
        const token = 'a'.repeat(64);
        const { rows: [manager] } = await pool.query(`
            INSERT INTO users (telegram_id, display_name, role)
            VALUES (999900001, 'Организатор', 'MANAGER') RETURNING id
        `);
        await pool.query(`
            INSERT INTO sessions (token_hash, user_id, expires_at, method)
            VALUES (decode($1, 'hex'), $2, now() + interval '1 day', 'telegram')
        `, [digest(token), manager.id]);
        function upload(kind, type, body) {
            return fetch(running.origin + '/api/admin/uploads/' + kind, {
                method: 'POST', body, headers: {
                    Origin: running.origin, Cookie: 'itd_session=' + token, 'Content-Type': type,
                },
            });
        }
        const legacyAudio = wav(4096);
        const legacyId = digest(legacyAudio);
        const legacyLink = '/api/audio/' + legacyId;
        await pool.query("INSERT INTO catalog_audio (id, media_type, contents) VALUES ($1, 'audio/wav', $2)",
            [legacyId, legacyAudio]);
        const legacyImage = await sharp({ create: { width: 30, height: 20, channels: 3, background: '#993300' } })
            .png().toBuffer();
        const legacyImageId = digest(legacyImage);
        await pool.query("INSERT INTO catalog_images (id, media_type, contents) VALUES ($1, 'image/png', $2)",
            [legacyImageId, legacyImage]);
        running = await startApp(env);

        await t.test('legacy originals work before the storage directory exists', async () => {
            await assert.rejects(stat(root), { code: 'ENOENT' });
            const original = await fetch(running.origin + legacyLink);
            assert.equal(original.status, 200);
            assert.equal(original.headers.get('content-type'), 'audio/wav');
            assert.match(original.headers.get('cache-control'), /immutable/);
            assert.deepEqual(Buffer.from(await original.arrayBuffer()), legacyAudio);
            await expectRange(running.origin, legacyLink, legacyAudio, 10, 21);
            const photo = await fetch(running.origin + '/api/media/' + legacyImageId);
            assert.deepEqual(Buffer.from(await photo.arrayBuffer()), legacyImage);
            const cached = await fetch(running.origin + legacyLink, {
                headers: { 'If-None-Match': original.headers.get('etag'), 'Cache-Control': 'max-age=0' },
            });
            assert.equal(cached.status, 304);
            const auth = await fetch(running.origin + '/api/auth/me', { headers: { Cookie: 'itd_session=' + token } });
            assert.equal(auth.headers.get('cache-control'), 'no-store');
            await auth.body.cancel();
        });

        await t.test('dry-run, checksum failures, successful copy, repair and safe retry', async () => {
            const mismatched = '0'.repeat(64);
            await pool.query("INSERT INTO catalog_audio (id, media_type, contents) VALUES ($1, 'audio/wav', $2)",
                [mismatched, legacyAudio]);
            const preview = await runTransfer(env);
            assert.equal(preview.code, 1);
            assert.equal(preview.report.planned, 2);
            assert.equal(preview.report.failed[0].id, mismatched);
            assert.equal(preview.report.disk.enough, true);
            await assert.rejects(stat(root), { code: 'ENOENT' });

            const applied = await runTransfer(env, '--apply');
            assert.equal(applied.code, 1);
            assert.equal(applied.report.completed, 2);
            const path = join(root, 'audio', legacyId + '.wav');
            assert.deepEqual(await readFile(path), legacyAudio);
            await pool.query('DELETE FROM catalog_audio WHERE id = $1', [mismatched]);
            const retry = await runTransfer(env, '--apply');
            assert.equal(retry.code, 0);
            assert.equal(retry.report.unchanged, 2);
            assert.equal(retry.report.completed, 0);
            await writeFile(path, Buffer.alloc(legacyAudio.length));
            const repair = await runTransfer(env, '--apply');
            assert.equal(repair.code, 0);
            assert.equal(repair.report.completed, 1);
            await writeFile(path, Buffer.from('truncated'));
            await expectRange(running.origin, legacyLink, legacyAudio, 0, 40);
            await runTransfer(env, '--apply');
            assert.deepEqual(await readFile(path), legacyAudio);
        });

        await t.test('regular uploads preserve URLs and publish a smaller thumbnail in the catalog', async () => {
            const image = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#445522' } })
                .png().toBuffer();
            const uploaded = await upload('images', 'image/png', image);
            assert.equal(uploaded.status, 201);
            const { data } = await uploaded.json();
            assert.equal(data.image_url, '/api/media/' + digest(image));
            assert.match(data.thumbnail_url, /^\/api\/media\/thumbnails\/[a-f0-9]{64}$/);
            const preview = await fetch(running.origin + data.thumbnail_url);
            assert.equal(preview.headers.get('content-type'), 'image/webp');
            const thumbnail = await sharp(Buffer.from(await preview.arrayBuffer())).metadata();
            assert.equal(thumbnail.width, 720);
            assert.equal(thumbnail.height, 480);
            const { rows: [nomination] } = await pool.query(
                "INSERT INTO nominations (title, status, image_url) VALUES ('Тест', 'open', $1) RETURNING id", [data.image_url],
            );
            await pool.query("INSERT INTO nominees (nomination_id, name, image_url) VALUES ($1, 'Тест', $2)",
                [nomination.id, data.image_url]);
            const catalog = await fetch(running.origin + '/api/nominations/' + nomination.id);
            assert.equal(catalog.headers.get('cache-control'), 'no-store');
            const result = (await catalog.json()).data;
            assert.equal(result.image_url, data.image_url);
            assert.equal(result.thumbnail_url, data.thumbnail_url);
            assert.equal(result.nominees[0].thumbnail_url, data.thumbnail_url);
            const invalid = await upload('audio', 'audio/wav', Buffer.alloc(64));
            assert.equal(invalid.status, 400);
            await invalid.body.cancel();
            const invalidImage = await upload('images', 'image/png', Buffer.alloc(64));
            assert.equal(invalidImage.status, 400);
            await invalidImage.body.cancel();
        });

        await t.test('an unavailable directory falls back for dual writes and rejects file-only writes', async () => {
            const blockedRoot = join(sandbox, 'unavailable');
            await writeFile(blockedRoot, 'not a directory');
            await running.stop();
            running = await startApp(env, { MEDIA_STORAGE_DIR: blockedRoot });
            const fallbackAudio = wav(732);
            const result = await upload('audio', 'audio/wav', fallbackAudio);
            assert.equal(result.status, 201);
            const link = (await result.json()).data.audio_url;
            await expectRange(running.origin, link, fallbackAudio, 50, 70);

            await running.stop();
            running = await startApp(env, { MEDIA_STORAGE_DIR: blockedRoot, MEDIA_FILE_ONLY: '1' });
            const rejectedAudio = wav(733);
            const rejected = await upload('audio', 'audio/wav', rejectedAudio);
            assert.equal(rejected.status, 503);
            await rejected.body.cancel();
            assert.equal((await pool.query('SELECT id FROM catalog_audio WHERE id = $1', [digest(rejectedAudio)])).rowCount, 0);
        });

        await t.test('disk-only audio supports seek, validators, errors, acceleration and rollback', async () => {
            await running.stop();
            running = await startApp(env, { MEDIA_FILE_ONLY: '1' });
            const audio = wav(8192);
            const uploaded = await upload('audio', 'audio/wav', audio);
            assert.equal(uploaded.status, 201);
            const id = digest(audio);
            const link = (await uploaded.json()).data.audio_url;
            assert.equal(link, '/api/audio/' + id);
            assert.equal((await pool.query('SELECT contents FROM catalog_audio WHERE id = $1', [id])).rows[0].contents, null);
            await expectRange(running.origin, link, audio, 4000, 4200);
            await expectRange(running.origin, link, audio, audio.length - 25, audio.length - 1, 'bytes=-25');
            const unsatisfiable = await fetch(running.origin + link, { headers: { Range: 'bytes=999999-' } });
            assert.equal(unsatisfiable.status, 416);
            assert.equal(unsatisfiable.headers.get('content-range'), 'bytes */' + audio.length);
            assert.equal(unsatisfiable.headers.get('cache-control'), 'no-store');
            await unsatisfiable.body.cancel();
            const head = await fetch(running.origin + link, { method: 'HEAD' });
            assert.equal(Number(head.headers.get('content-length')), audio.length);
            assert.equal(head.headers.get('etag'), '"' + id + '"');
            const unchanged = await fetch(running.origin + link, {
                headers: { 'If-Modified-Since': head.headers.get('last-modified'), 'Cache-Control': 'max-age=0' },
            });
            assert.equal(unchanged.status, 304);
            const newVersion = await fetch(running.origin + link, { headers: { Range: 'bytes=1-2', 'If-Range': '"old"' } });
            assert.equal(newVersion.status, 200);
            assert.deepEqual(Buffer.from(await newVersion.arrayBuffer()), audio);
            for (const path of ['/api/audio/invalid', '/api/audio/' + 'f'.repeat(64), '/api/media/%2e%2e%2fsecret']) {
                const response = await fetch(running.origin + path);
                assert.equal(response.status, 404);
                await response.body.cancel();
            }

            await running.stop();
            running = await startApp(env, { MEDIA_NGINX_ACCEL: '1' });
            const accelerated = await fetch(running.origin + link);
            assert.equal(accelerated.headers.get('x-accel-redirect'), '/_itd_media/audio/' + id + '.wav');
            await accelerated.body.cancel();
            const restorePlan = await runTransfer(env, '--restore-db');
            assert.equal(restorePlan.report.planned, 1);
            assert.equal((await runTransfer(env, '--restore-db', '--apply')).report.completed, 1);
            await rm(join(root, 'audio', id + '.wav'));
            await expectRange(running.origin, link, audio, 100, 199);

            await rm(join(root, 'audio', legacyId + '.wav'));
            await pool.query('UPDATE catalog_audio SET byte_size = octet_length(contents), contents = NULL WHERE id = $1', [legacyId]);
            const missing = await fetch(running.origin + legacyLink);
            assert.equal(missing.status, 503);
            assert.equal(missing.headers.get('cache-control'), 'no-store');
            await missing.body.cancel();
        });
    });
