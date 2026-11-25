import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, statfs, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const mediaIdPattern = /^[a-f0-9]{64}$/;
export const imageMedia = {
    directory: 'images', table: 'catalog_images', auditType: 'catalog_image', prefix: '/api/media/',
    extensions: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' },
};
export const audioMedia = {
    directory: 'audio', table: 'catalog_audio', auditType: 'catalog_audio', prefix: '/api/audio/',
    extensions: { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm' },
};
export const thumbnailMedia = {
    directory: 'thumbnails', prefix: '/api/media/thumbnails/',
    extensions: { 'image/webp': 'webp' },
};
export const thumbnailType = 'image/webp';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const configuredRoot = process.env.MEDIA_STORAGE_DIR?.trim();

function outsideProject(path) {
    const fromProject = relative(projectRoot, path);
    return isAbsolute(fromProject) || fromProject === '..' || fromProject.startsWith('..' + sep);
}

if (configuredRoot && (!isAbsolute(configuredRoot) || !outsideProject(resolve(configuredRoot)))) {
    throw new Error('MEDIA_STORAGE_DIR must be an absolute path outside the repository.');
}
export const storageRoot = configuredRoot ? resolve(configuredRoot) : null;
export const fileOnly = process.env.MEDIA_FILE_ONLY === '1';
export const nginxAccel = process.env.MEDIA_NGINX_ACCEL === '1';

export function mediaDigest(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

function mediaName(kind, id, mediaType) {
    if (!mediaIdPattern.test(id) || !Object.hasOwn(kind.extensions, mediaType)) {
        throw new TypeError('Invalid media identifier or type.');
    }
    return id + '.' + kind.extensions[mediaType];
}

export function internalMediaUrl(kind, id, mediaType) {
    return '/_itd_media/' + kind.directory + '/' + mediaName(kind, id, mediaType);
}

async function mediaDirectory(kind, create = false) {
    if (!storageRoot) throw Object.assign(new Error('MEDIA_STORAGE_DIR is not configured.'), { code: 'ENOENT' });
    const directory = join(storageRoot, kind.directory);
    if (create) await mkdir(storageRoot, { recursive: true, mode: 0o750 });
    if (!(await lstat(storageRoot)).isDirectory() || !outsideProject(await realpath(storageRoot))) {
        throw Object.assign(new Error('The media root is not a dedicated directory.'), { code: 'EINVAL' });
    }
    if (create) await mkdir(directory, { recursive: true, mode: 0o750 });
    if (!(await lstat(directory)).isDirectory()) {
        throw Object.assign(new Error('The media directory is not a dedicated directory.'), { code: 'EINVAL' });
    }
    return directory;
}

export async function openMediaFile(kind, id, mediaType, expectedSize) {
    const name = mediaName(kind, id, mediaType);
    if (!storageRoot) return null;
    let handle;
    try {
        const path = join(await mediaDirectory(kind), name);
        if (!(await lstat(path)).isFile()) return null;
        handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
        const stat = await handle.stat();
        if (stat.isFile() && stat.size > 0 && (expectedSize === undefined || stat.size === expectedSize)) {
            return { handle, stat };
        }
    } catch (error) {
        if (!error.code) throw error;
    }
    await handle?.close();
    return null;
}

export async function verifyMediaFile(kind, id, mediaType, size) {
    const file = await openMediaFile(kind, id, mediaType, size);
    if (!file) return false;
    try {
        const hash = createHash('sha256');
        for await (const chunk of file.handle.createReadStream({ autoClose: false })) hash.update(chunk);
        return hash.digest('hex') === id;
    } finally {
        await file.handle.close();
    }
}

export async function writeMediaFile(kind, id, mediaType, bytes) {
    const name = mediaName(kind, id, mediaType);
    if (await verifyMediaFile(kind, id, mediaType, bytes.length)) return;
    const directory = await mediaDirectory(kind, true);
    const temporary = join(directory, '.' + randomUUID() + '.tmp');
    const handle = await open(temporary, 'wx', 0o640);
    try {
        try {
            await handle.writeFile(bytes);
            await handle.sync();
        } finally {
            await handle.close();
        }
        await rename(temporary, join(directory, name));
        if (process.platform !== 'win32') {
            const parent = await open(directory, constants.O_RDONLY);
            try {
                await parent.sync();
            } finally {
                await parent.close();
            }
        }
    } finally {
        await unlink(temporary).catch((error) => {
            if (error.code !== 'ENOENT') throw error;
        });
    }
}

export async function mediaFreeBytes() {
    if (!storageRoot) throw new Error('Set MEDIA_STORAGE_DIR before copying media.');
    let probe = storageRoot;
    for (;;) {
        try {
            if (!(await lstat(probe)).isDirectory() || !outsideProject(await realpath(probe))) {
                throw Object.assign(new Error('The media volume is not a dedicated directory.'), { code: 'EINVAL' });
            }
            const stat = await statfs(probe, { bigint: true });
            return stat.bavail * stat.bsize;
        } catch (error) {
            const parent = dirname(probe);
            if (error.code !== 'ENOENT' || parent === probe) throw error;
            probe = parent;
        }
    }
}
