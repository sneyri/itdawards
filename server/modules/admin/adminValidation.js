export class AdminError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export function invalid(message = 'Проверьте значения полей.') {
    throw new AdminError(400, 'invalid_input', message);
}

export function string(max, required = false) {
    return (value) => {
        if (typeof value !== 'string' || value.includes('\0')) invalid();
        const trimmed = value.trim();
        if (trimmed.length > max || (required && !trimmed)) invalid();
        return trimmed;
    };
}

export function url(allowAsset = false) {
    return (value) => {
        if (value === null) return null;
        const raw = string(2048)(value);
        if (allowAsset && /^\/assets\/(?:[\p{L}\p{N}_.-]+\/)*[\p{L}\p{N}_.-]+$/u.test(raw)
            && !raw.split('/').some((part) => part === '.' || part === '..')) return raw;
        if (allowAsset && /^\/api\/media\/[a-f0-9]{64}$/.test(raw)) return raw;
        const parsed = URL.parse(raw);
        if (parsed?.protocol !== 'https:' || parsed.username || parsed.password) {
            invalid(allowAsset ? 'Укажите HTTPS-адрес или путь /assets/…' : 'Укажите HTTPS-адрес ссылки.');
        }
        return parsed.href;
    };
}

export function integer(min, max) {
    return (value) => {
        if (!Number.isInteger(value) || value < min || value > max) invalid();
        return value;
    };
}

export function boolean(value) {
    if (typeof value !== 'boolean') invalid();
    return value;
}

export function choice(choices) {
    return (value) => {
        if (!choices.includes(value)) invalid();
        return value;
    };
}

export function date(value) {
    if (value === null) return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
        invalid('Укажите дату и время в формате ISO с часовым поясом UTC.');
    }
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value || value.startsWith('0000')) {
        invalid('Некорректная дата голосования.');
    }
    return parsed;
}

export function validateFields(body, fields, { required = [], confirmation = false } = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) invalid();
    if (confirmation && body.confirmed !== true) invalid('Подтвердите изменение.');
    const entries = Object.entries(body);
    const fieldCount = confirmation ? entries.length - 1 : entries.length;
    if (!fieldCount || required.some((field) => !Object.hasOwn(body, field))) invalid();
    const validated = {};
    for (const [field, value] of entries) {
        if (confirmation && field === 'confirmed') continue;
        if (!Object.hasOwn(fields, field)) invalid('Запрос содержит неизвестное поле.');
        validated[field] = fields[field](value);
    }
    return validated;
}

export function notFound(kind) {
    throw new AdminError(404, 'not_found', `${kind} не найден${kind === 'Номинация' ? 'а' : ''}.`);
}
