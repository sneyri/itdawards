import { crc32 } from 'node:zlib';
import { sendError } from '../../middleware/errorHandler.js';
import { saveCatalogMedia } from '../media/catalogMedia.js';
import { imageMedia } from '../media/mediaStorage.js';

export const rasterTypes = Object.keys(imageMedia.extensions);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const jpegFrames = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];

function pngSize(bytes) {
    if (bytes.length < 45 || !bytes.subarray(0, 8).equals(pngSignature)
        || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
    let hasPixels = false;
    for (let offset = 8; offset + 12 <= bytes.length;) {
        const payloadLength = bytes.readUInt32BE(offset);
        const checksumOffset = offset + 8 + payloadLength;
        if (checksumOffset + 4 > bytes.length
            || crc32(bytes.subarray(offset + 4, checksumOffset)) !== bytes.readUInt32BE(checksumOffset)) return null;
        const chunk = bytes.toString('ascii', offset + 4, offset + 8);
        if (chunk === 'IDAT' && payloadLength > 0) hasPixels = true;
        if (chunk === 'IEND' && payloadLength === 0 && hasPixels && checksumOffset + 4 === bytes.length) {
            return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
        }
        offset = checksumOffset + 4;
    }
    return null;
}

function jpegSize(bytes) {
    if (bytes.length < 20 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) return null;
    let size = null;
    for (let offset = 2; offset + 4 < bytes.length;) {
        if (bytes[offset++] !== 0xff) return null;
        while (bytes[offset] === 0xff) offset++;
        if (offset + 3 > bytes.length) return null;
        const marker = bytes[offset++];
        const length = bytes.readUInt16BE(offset);
        if (length < 2 || offset + length > bytes.length) return null;
        if (marker === 0xda) return offset + length + 2 < bytes.length ? size : null;
        if (jpegFrames.includes(marker)) {
            if (length < 8) return null;
            size = [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
        }
        offset += length;
    }
    return null;
}

function webpSize(bytes) {
    if (bytes.length < 25 || bytes.toString('ascii', 0, 4) !== 'RIFF'
        || bytes.readUInt32LE(4) + 8 !== bytes.length || bytes.toString('ascii', 8, 12) !== 'WEBP'
        || bytes.readUInt32LE(16) + 20 > bytes.length) return null;
    switch (bytes.toString('ascii', 12, 16)) {
        case 'VP8X':
            if (bytes.length < 30 || bytes.readUInt32LE(16) !== 10 || (bytes[20] & 0x02)) return null;
            return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
        case 'VP8L': {
            if (bytes[20] !== 0x2f || bytes.readUInt32LE(16) < 5) return null;
            const dimensions = bytes.readUInt32LE(21);
            return [(dimensions & 0x3fff) + 1, ((dimensions >>> 14) & 0x3fff) + 1];
        }
        case 'VP8 ':
            if (bytes.length < 30 || bytes.readUInt32LE(16) < 10 || bytes.readUIntBE(23, 3) !== 0x9d012a) return null;
            return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
        default:
            return null;
    }
}

const imageSize = { 'image/png': pngSize, 'image/jpeg': jpegSize, 'image/webp': webpSize };

export async function uploadCatalogImage(req, res) {
    const mediaType = req.is(rasterTypes);
    if (!mediaType) return sendError(res, 415, 'unsupported_image', 'Загрузите PNG, JPEG или WebP.');
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length > 5 * 1024 * 1024) {
        return sendError(res, 400, 'invalid_image', 'Изображение должно быть до 5 МБ.');
    }
    const size = Buffer.isBuffer(bytes) && imageSize[mediaType](bytes);
    if (!size || size.some((side) => side < 1 || side > 4096)) {
        return sendError(res, 400, 'invalid_image', 'Проверьте формат и размер изображения. Максимум 4096 × 4096 пикселей.');
    }
    return saveCatalogMedia(req, res, imageMedia, mediaType, bytes);
}
