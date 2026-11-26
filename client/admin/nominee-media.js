import { el, showDialog } from './ui.js';

export function safeImage(value) {
    if (!value) return null;
    if (/^\/api\/media\/[a-f0-9]{64}$/.test(value)) return value;
    if (/^\/(?:assets|images)\//.test(value) && !value.includes('\\')) return value;
    try {
        const address = new URL(value);
        return address.protocol === 'https:' && !address.username && !address.password ? address.href : null;
    } catch {
        return null;
    }
}

export function nomineeArt(row, className) {
    const words = row.name.replace(/«[^»]*»|"[^"]*"/gu, '').match(/[\p{L}\p{N}]+/gu)
        ?? row.name.match(/[\p{L}\p{N}]+/gu) ?? [];
    const initials = words.slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase() || '–';
    const art = el('span', { class: className, 'aria-hidden': 'true' }, initials);
    const original = safeImage(row.image_url);
    const src = safeImage(row.thumbnail_url) || original;
    if (src) {
        const picture = el('img', { alt: '', src, loading: 'lazy', decoding: 'async' });
        picture.addEventListener('error', () => {
            if (original && picture.getAttribute('src') !== original) picture.src = original;
            else picture.remove();
        });
        art.append(picture);
    }
    return art;
}

export function nomineeDetails(row, action) {
    return showDialog(row.name, el('div', { class: 'nominee-profile' },
        nomineeArt(row, 'nominee-profile__art'), el('div', { class: 'form-stack' },
            row.handle && el('p', { class: 'mono muted' }, row.handle),
            row.song && el('p', {}, row.song),
            el('p', { class: 'nominee-profile__description' }, row.description || 'Описание отсутствует.'),
            action)));
}
