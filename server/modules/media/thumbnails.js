import sharp from 'sharp';
import { mediaDigest, thumbnailMedia, thumbnailType, writeMediaFile } from './mediaStorage.js';

export const thumbnailMaxBytes = 1024 * 1024;

export async function createThumbnail(original) {
    const bytes = await sharp(original, { limitInputPixels: 4096 ** 2, failOn: 'warning' })
        .autoOrient()
        .resize(720, 720, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    if (bytes.length > thumbnailMaxBytes) throw new Error('The WebP thumbnail exceeds the size limit.');
    return { id: mediaDigest(bytes), bytes };
}

export async function storeThumbnail(thumbnail) {
    await writeMediaFile(thumbnailMedia, thumbnail.id, thumbnailType, thumbnail.bytes);
    return thumbnail.id;
}
