import pool from './db.js';
import {
    audioMedia, imageMedia, mediaDigest, mediaFreeBytes, openMediaFile, storageRoot,
    thumbnailMedia, thumbnailType, verifyMediaFile, writeMediaFile,
} from '../modules/media/mediaStorage.js';
import { createThumbnail, storeThumbnail, thumbnailMaxBytes } from '../modules/media/thumbnails.js';

const flags = process.argv.slice(2);
const apply = flags.includes('--apply');
const restore = flags.includes('--restore-db');

async function readOriginal(kind, row, fromDisk) {
    let bytes;
    if (fromDisk) {
        const file = await openMediaFile(kind, row.id, row.media_type, row.byte_size);
        if (!file) throw new Error('Файл отсутствует или его размер изменился.');
        try {
            bytes = await file.handle.readFile();
        } finally {
            await file.handle.close();
        }
    } else {
        const { rows: [original] } = await pool.query(`SELECT contents FROM ${kind.table} WHERE id = $1`, [row.id]);
        bytes = original?.contents;
    }
    if (bytes?.length !== row.byte_size || mediaDigest(bytes) !== row.id) {
        throw new Error('Размер или SHA-256 оригинала не совпадает с метаданными.');
    }
    return bytes;
}

async function scan(kind, onRecord) {
    let after = '';
    const thumbnail = kind === imageMedia ? ', thumbnail_id' : '';
    for (;;) {
        const { rows } = await pool.query(`
            SELECT id, media_type, COALESCE(byte_size, octet_length(contents)) AS byte_size,
                contents IS NOT NULL AS has_contents ${thumbnail}
            FROM ${kind.table}
            WHERE id > $1 AND (NOT $2::boolean OR contents IS NULL)
            ORDER BY id LIMIT 100
        `, [after, restore]);
        if (!rows.length) return;
        for (const row of rows) await onRecord(kind, row);
        after = rows.at(-1).id;
    }
}

async function planTransfer(kind, row) {
    const onDisk = await verifyMediaFile(kind, row.id, row.media_type, row.byte_size);
    if (restore) {
        if (!onDisk) throw new Error('Файл отсутствует или не прошёл проверку SHA-256.');
        return { fromDisk: true, copyOriginal: true, createPreview: false, required: 0n };
    }
    const previewReady = kind !== imageMedia || (row.thumbnail_id
        && await verifyMediaFile(thumbnailMedia, row.thumbnail_id, thumbnailType));
    if (onDisk && previewReady) return null;

    if (!onDisk) {
        if (!row.has_contents) throw new Error('Исправный оригинал отсутствует и на диске, и в базе.');
        await readOriginal(kind, row, false);
    }
    const required = BigInt(onDisk ? 0 : row.byte_size) + BigInt(previewReady ? 0 : thumbnailMaxBytes);
    return { fromDisk: onDisk, copyOriginal: !onDisk, createPreview: !previewReady, required };
}

async function transfer(kind, row, plan) {
    const bytes = await readOriginal(kind, row, plan.fromDisk);
    if (restore) {
        await pool.query(`UPDATE ${kind.table} SET contents = $2 WHERE id = $1 AND contents IS NULL`, [row.id, bytes]);
        return;
    }
    if (plan.copyOriginal) {
        await writeMediaFile(kind, row.id, row.media_type, bytes);
        if (!await verifyMediaFile(kind, row.id, row.media_type, row.byte_size)) {
            throw new Error('Записанный оригинал не прошёл проверку SHA-256.');
        }
    }
    if (plan.createPreview) {
        const thumbnail = await createThumbnail(bytes);
        const id = await storeThumbnail(thumbnail);
        if (!await verifyMediaFile(thumbnailMedia, id, thumbnailType, thumbnail.bytes.length)) {
            throw new Error('Записанная миниатюра не прошла проверку SHA-256.');
        }
        await pool.query('UPDATE catalog_images SET thumbnail_id = $2 WHERE id = $1 AND thumbnail_id IS DISTINCT FROM $2',
            [row.id, id]);
    }
}

async function run() {
    if (flags.some((flag) => !['--apply', '--restore-db'].includes(flag)) || new Set(flags).size !== flags.length) {
        throw new Error('Использование: npm run db:media -- [--restore-db] [--apply]');
    }
    if (!storageRoot) throw new Error('Настройте MEDIA_STORAGE_DIR.');
    const pending = [];
    const report = {
        mode: restore ? 'restore-db' : 'copy-to-files', dryRun: !apply, unchanged: 0, planned: 0,
        completed: 0, failed: [], operations: [],
    };
    function failed(kind, row, error) {
        report.failed.push({ kind: kind.directory, id: row.id, message: error.code ?? error.message });
    }
    for (const kind of [imageMedia, audioMedia]) {
        await scan(kind, async (media, row) => {
            try {
                const plan = await planTransfer(media, row);
                if (plan) pending.push({ kind: media, row, plan });
                else report.unchanged++;
            } catch (error) {
                failed(media, row, error);
            }
        });
    }
    report.planned = pending.length;
    if (!restore) {
        const required = pending.reduce((bytes, { plan }) => bytes + plan.required, 0n);
        const available = await mediaFreeBytes();
        report.disk = { required: String(required), available: String(available), enough: available >= required };
    }
    for (const { kind, row, plan } of pending) {
        try {
            if (apply) {
                if (report.disk && (!report.disk.enough || await mediaFreeBytes() < plan.required)) {
                    throw new Error('Недостаточно свободного места.');
                }
                await transfer(kind, row, plan);
                report.completed++;
            }
            report.operations.push({ kind: kind.directory, id: row.id, copyOriginal: plan.copyOriginal, createPreview: plan.createPreview });
        } catch (error) {
            failed(kind, row, error);
        }
    }
    console.log(JSON.stringify(report, null, 2));
    if (report.failed.length || report.disk?.enough === false) process.exitCode = 1;
}

try {
    await run();
} catch (error) {
    console.error('Перенос медиа:', error.code ?? error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
