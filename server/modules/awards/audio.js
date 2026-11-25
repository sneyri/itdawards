import { sendError } from '../../middleware/errorHandler.js';
import { saveCatalogMedia } from '../media/catalogMedia.js';
import { audioMedia } from '../media/mediaStorage.js';

export const audioTypes = Object.keys(audioMedia.extensions);
const audioLimit = 20 * 1024 * 1024;

function matchesAudioType(bytes, type) {
    if (bytes.length < 12) return false;
    const tag = bytes.toString('latin1', 0, 4);
    switch (type) {
        case 'audio/mpeg':
            return tag.startsWith('ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
        case 'audio/mp4': return bytes.toString('latin1', 4, 8) === 'ftyp';
        case 'audio/wav': return ['RIFF', 'RF64'].includes(tag) && bytes.toString('latin1', 8, 12) === 'WAVE';
        case 'audio/ogg': return tag === 'OggS';
        case 'audio/webm': return bytes.readUInt32BE() === 0x1a45dfa3;
        default: return false;
    }
}

export async function uploadCatalogAudio(req, res) {
    const mediaType = req.is(audioTypes);
    if (!mediaType) return sendError(res, 415, 'unsupported_audio', 'Загрузите MP3, M4A, WAV, OGG или WebM.');
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length > audioLimit) {
        return sendError(res, 400, 'invalid_audio', 'Аудиофайл должен быть до 20 МиБ.');
    }
    if (!matchesAudioType(bytes, mediaType)) {
        return sendError(res, 400, 'invalid_audio', 'Содержимое файла не соответствует указанному формату аудио.');
    }
    return saveCatalogMedia(req, res, audioMedia, mediaType, bytes);
}
