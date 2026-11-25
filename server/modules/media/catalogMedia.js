import { pipeline } from 'node:stream/promises';
import pool, { transaction } from '../../database/db.js';
import { sendError } from '../../middleware/errorHandler.js';
import {
    audioMedia, fileOnly, imageMedia, internalMediaUrl, mediaDigest, mediaIdPattern,
    nginxAccel, openMediaFile, storageRoot, thumbnailMedia, thumbnailType, writeMediaFile,
} from './mediaStorage.js';
import { createThumbnail, storeThumbnail } from './thumbnails.js';

const mediaHeaders = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
};

function unavailable(res) {
    return sendError(res, 503, 'media_unavailable', 'Медиафайл временно недоступен.');
}

export async function saveCatalogMedia(req, res, kind, mediaType, bytes) {
    if (!storageRoot && fileOnly) return unavailable(res);
    const id = mediaDigest(bytes);
    let thumbnail;
    if (kind === imageMedia && storageRoot) {
        try {
            thumbnail = await createThumbnail(bytes);
        } catch {
            return sendError(res, 400, 'invalid_image', 'Не удалось прочитать изображение.');
        }
    }
    let saved;
    try {
        saved = await transaction(async (client) => {
            const { rowCount } = await client.query(`
                SELECT 1 FROM users WHERE id = $1 AND role IN ('MANAGER', 'SUPERADMIN') AND NOT blocked FOR SHARE
            `, [req.user.id]);
            if (!rowCount) return null;

            // The first successful upload determines the type of a content-addressed original.
            const { rows: [inserted] } = await client.query(`
                INSERT INTO ${kind.table} (id, media_type, contents, byte_size)
                VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING RETURNING media_type
            `, [id, mediaType, fileOnly ? null : bytes, bytes.length]);
            const original = inserted ?? (await client.query(`
                SELECT media_type, contents IS NOT NULL AS has_contents FROM ${kind.table} WHERE id = $1
            `, [id])).rows[0];
            let thumbnailId;
            if (storageRoot) {
                try {
                    await writeMediaFile(kind, id, original.media_type, bytes);
                    if (thumbnail) {
                        thumbnailId = await storeThumbnail(thumbnail);
                    }
                } catch (error) {
                    if (fileOnly) {
                        throw Object.assign(new Error('Media storage write failed.', { cause: error }), { code: 'MEDIA_WRITE_FAILED' });
                    }
                    console.warn('Media storage write failed:', error.code ?? error.name);
                }
            }
            if (!fileOnly && !inserted && !original.has_contents) {
                await client.query(`UPDATE ${kind.table} SET contents = $2 WHERE id = $1 AND contents IS NULL`, [id, bytes]);
            }
            if (thumbnailId) {
                await client.query('UPDATE catalog_images SET thumbnail_id = $2 WHERE id = $1 AND thumbnail_id IS DISTINCT FROM $2',
                    [id, thumbnailId]);
            }
            if (inserted) {
                await client.query(`
                    INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
                    VALUES ($1, 'media.uploaded', $2, $3, $4)
                `, [req.user.id, kind.auditType, id, { media_type: mediaType, size: bytes.length }]);
            }
            return { thumbnailId };
        });
    } catch (error) {
        if (error.code === 'MEDIA_WRITE_FAILED') return unavailable(res);
        throw error;
    }
    if (!saved) return sendError(res, 403, 'forbidden', 'Недостаточно прав.');
    const data = { [kind === audioMedia ? 'audio_url' : 'image_url']: kind.prefix + id };
    if (saved.thumbnailId) data.thumbnail_url = thumbnailMedia.prefix + saved.thumbnailId;
    return res.status(201).json({ data });
}

function readRange(req, size, etag, lastModified) {
    const header = req.get('range');
    if (req.method !== 'GET' || !header || !/^bytes\s*=/i.test(header) || header.includes(',')) return null;
    const ifRange = req.get('if-range');
    if (ifRange && ifRange !== etag && Date.parse(ifRange) !== Date.parse(lastModified)) return null;
    const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
    if (!match || (!match[1] && !match[2])) return false;
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return false;
    return { start, end };
}

async function sendMedia(req, res, kind, id, row, file) {
    if (file && nginxAccel) {
        // The internal Nginx location supplies validators, cache headers and byte ranges.
        res.removeHeader('Cache-Control');
        return res.type(row.media_type).set('X-Accel-Redirect', internalMediaUrl(kind, id, row.media_type)).end();
    }

    const size = row.byte_size;
    const etag = `"${id}"`;
    const lastModified = row.created_at.toUTCString();
    res.set({ ETag: etag, 'Last-Modified': lastModified });
    if (req.fresh) return res.status(304).set(mediaHeaders).end();
    const range = readRange(req, size, etag, lastModified);
    if (range === false) {
        return res.status(416).set({ 'Accept-Ranges': 'bytes', 'Content-Range': 'bytes */' + size }).end();
    }
    const { start, end } = range ?? { start: 0, end: size - 1 };
    const length = end - start + 1;
    let bytes;
    if (!file && req.method !== 'HEAD') {
        const { rows: [result] } = await pool.query(
            `SELECT substring(contents FROM $2::integer FOR $3::integer) AS bytes FROM ${kind.table} WHERE id = $1`,
            [id, start + 1, length],
        );
        bytes = result?.bytes;
        if (bytes?.length !== length) return unavailable(res);
    }
    res.set({ ...mediaHeaders, 'Content-Length': String(length) }).type(row.media_type);
    if (range) res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
    if (req.method === 'HEAD') return res.end();
    if (bytes) return res.end(bytes);
    try {
        await pipeline(file.handle.createReadStream({ start, end, autoClose: false }), res);
    } catch (error) {
        if (!res.destroyed) throw error;
    }
}

export async function serveCatalogMedia(req, res, kind) {
    const id = req.params.id;
    if (!mediaIdPattern.test(id)) return sendError(res, 404, 'not_found', 'Медиафайл не найден.');
    const { rows: [row] } = await pool.query(`
        SELECT media_type, COALESCE(byte_size, octet_length(contents)) AS byte_size, created_at,
            contents IS NOT NULL AS has_contents
        FROM ${kind.table} WHERE id = $1
    `, [id]);
    if (!row) return sendError(res, 404, 'not_found', 'Медиафайл не найден.');

    const file = await openMediaFile(kind, id, row.media_type, row.byte_size);
    if (!file && !row.has_contents) return unavailable(res);
    try {
        return await sendMedia(req, res, kind, id, row, file);
    } finally {
        await file?.handle.close();
    }
}

export async function serveThumbnail(req, res) {
    const id = req.params.id;
    if (!mediaIdPattern.test(id)) return sendError(res, 404, 'not_found', 'Миниатюра не найдена.');
    const file = await openMediaFile(thumbnailMedia, id, thumbnailType);
    if (!file) return sendError(res, 404, 'not_found', 'Миниатюра не найдена.');
    try {
        return await sendMedia(req, res, thumbnailMedia, id, {
            media_type: thumbnailType, byte_size: file.stat.size, created_at: file.stat.mtime,
        }, file);
    } finally {
        await file.handle.close();
    }
}
