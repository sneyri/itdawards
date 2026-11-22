import { createHash } from 'node:crypto';
import pool, { transaction } from '../../database/db.js';
import { sendError } from '../../middleware/errorHandler.js';

export const audioTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm'];
const audioLimit = 20 * 1024 * 1024;

const mediaHeaders = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
};

export async function uploadCatalogAudio(req, res) {
    const mediaType = req.is(audioTypes);
    if (!mediaType) return sendError(res, 415, 'unsupported_audio', 'Загрузите MP3, M4A, WAV, OGG или WebM.');
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > audioLimit) {
        return sendError(res, 400, 'invalid_audio', 'Аудиофайл должен быть до 20 МиБ.');
    }
    const id = createHash('sha256').update(bytes).digest('hex');
    const allowed = await transaction(async (client) => {
        const { rowCount } = await client.query(`
            SELECT 1 FROM users WHERE id = $1 AND role IN ('MANAGER', 'SUPERADMIN') AND NOT blocked FOR SHARE
        `, [req.user.id]);
        if (!rowCount) return false;
        const audio = await client.query(`
            INSERT INTO catalog_audio (id, media_type, contents) VALUES ($1, $2, $3)
            ON CONFLICT (id) DO NOTHING
        `, [id, mediaType, bytes]);
        if (audio.rowCount) {
            await client.query(`
                INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
                VALUES ($1, 'media.uploaded', 'catalog_audio', $2, $3)
            `, [req.user.id, id, { media_type: mediaType, size: bytes.length }]);
        }
        return true;
    });
    if (!allowed) return sendError(res, 403, 'forbidden', 'Недостаточно прав.');
    return res.status(201).json({ data: { audio_url: '/api/audio/' + id } });
}

export async function serveCatalogAudio(req, res) {
    if (!/^[a-f0-9]{64}$/.test(req.params.id)) return sendError(res, 404, 'not_found', 'Аудио не найдено.');
    const { rows: [audio] } = await pool.query('SELECT media_type, contents FROM catalog_audio WHERE id = $1', [req.params.id]);
    if (!audio) return sendError(res, 404, 'not_found', 'Аудио не найдено.');

    const bytes = audio.contents;
    const total = bytes.length;
    const headers = { ...mediaHeaders, 'Accept-Ranges': 'bytes' };
    const requested = req.headers.range;
    if (!requested) return res.set(headers).type(audio.media_type).send(bytes);

    const match = /^bytes=(\d*)-(\d*)$/.exec(requested.trim());
    if (!match || (!match[1] && !match[2])) {
        return res.set({ 'Content-Range': 'bytes */' + total }).status(416).end();
    }
    let start;
    let end;
    if (match[1]) {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : total - 1;
    } else {
        start = Math.max(0, total - Number(match[2]));
        end = total - 1;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= total || end < start) {
        return res.set({ 'Content-Range': 'bytes */' + total }).status(416).end();
    }
    end = Math.min(end, total - 1);
    return res.set({
        ...headers,
        'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
        'Content-Length': end - start + 1,
    }).status(206).type(audio.media_type).send(bytes.subarray(start, end + 1));
}
