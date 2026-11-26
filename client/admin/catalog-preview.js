const MAX_FILE_BYTES = 512 * 1024;
const INT32_MAX = 2147483647;

function isText(value, max) {
    return typeof value === 'string' && !value.includes('\0') && value.trim().length <= max;
}

function optionalText(max) {
    return [value => value === null || isText(value, max), `Укажите текст до ${max} символов или null.`];
}

function isImportUrl(value, allowAsset = false) {
    if (value === null) return true;
    if (!isText(value, 2048)) return false;
    const source = value.trim();
    if (allowAsset && (/^\/api\/(?:media|audio)\/[a-f0-9]{64}$/.test(source)
        || (/^\/assets\/(?:[\p{L}\p{N}_.-]+\/)*[\p{L}\p{N}_.-]+$/u.test(source)
            && !source.split('/').some(part => part === '.' || part === '..')))) return true;
    try {
        const url = new URL(source);
        return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
        return false;
    }
}

// Import fields mirror the schema 1 contract in server/modules/awards/adminCatalog.js.
const mediaField = [value => isImportUrl(value, true), 'Укажите HTTPS-адрес, локальный путь к медиа или null.'];
const contentFields = {
    description: [value => isText(value, 1200), 'Укажите текст до 1200 символов.'],
    image_url: mediaField,
    sort_order: [value => Number.isInteger(value) && value >= -INT32_MAX - 1 && value <= INT32_MAX,
        'Укажите целое число от −2147483648 до 2147483647.'],
    archived: [value => typeof value === 'boolean', 'Укажите true или false.'],
};
const nominationFields = {
    ...contentFields,
    status: [value => ['draft', 'open', 'closed'].includes(value), 'Укажите draft, open или closed.'],
};
const nomineeFields = {
    ...contentFields,
    handle: optionalText(100),
    song: optionalText(200),
    image_alt: optionalText(300),
    audio_url: mediaField,
    link_url: [isImportUrl, 'Укажите HTTPS-адрес или null.'],
};

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function importName(value, location) {
    if (!isText(value, 160) || !value.trim()) {
        throw new Error(`${location}. Введите имя или название длиной от 1 до 160 символов.`);
    }
    return value.trim();
}

function validateFields(record, fields, location) {
    for (const [field, value] of Object.entries(record)) {
        if (!Object.hasOwn(fields, field)) throw new Error(`${location}. Неизвестное поле «${field}».`);
        const [valid, message] = fields[field];
        if (!valid(value)) throw new Error(`${location}, поле «${field}». ${message}`);
    }
}

export async function readCatalogImport(file, currentCatalog) {
    if (!file?.size || file.size > MAX_FILE_BYTES) throw new Error('Выберите JSON-файл до 512 КБ.');
    let data;
    try {
        data = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
    } catch {
        throw new Error('Файл содержит некорректный JSON.');
    }
    if (data?.schema !== 1 || !Array.isArray(data.nominations)) {
        throw new Error('Используйте экспорт каталога с версией схемы 1.');
    }
    if (!data.nominations.length || data.nominations.length > 60) {
        throw new Error('Укажите от 1 до 60 номинаций.');
    }
    const body = JSON.stringify({ confirmed: true, schema: 1, nominations: data.nominations });
    if (new TextEncoder().encode(body).length > MAX_FILE_BYTES) {
        throw new Error('Данные для отправки превышают 512 КБ. Разделите каталог на несколько файлов.');
    }

    const currentByTitle = new Map();
    for (const row of currentCatalog) {
        const matches = currentByTitle.get(row.title);
        if (matches) matches.push(row);
        else currentByTitle.set(row.title, [row]);
    }
    const summary = new Map();
    let totalNominees = 0;

    // The import keeps exact title and name matches, including archived entries.
    for (const [index, nomination] of data.nominations.entries()) {
        const location = `Номинация № ${index + 1}`;
        if (!isRecord(nomination)) throw new Error(`${location}. Ожидается объект.`);
        const { title: rawTitle, nominees = [], ...fields } = nomination;
        const title = importName(rawTitle, location);
        validateFields(fields, nominationFields, location);
        if (!Array.isArray(nominees)) throw new Error(`${location}. Номинанты должны быть массивом.`);
        totalNominees += nominees.length;
        if (totalNominees > 600) throw new Error('В одном файле может быть не больше 600 номинантов.');

        let entry = summary.get(title);
        if (!entry) {
            const matching = currentByTitle.get(title) ?? [];
            if (matching.length > 1) throw new Error(`В каталоге несколько номинаций «${title}». Уточните название перед импортом.`);
            entry = {
                title,
                create: matching.length === 0,
                knownNames: new Set((matching[0]?.nominees ?? []).map(row => row.name)),
                added: 0,
                skipped: 0,
            };
            summary.set(title, entry);
        }
        for (const [nomineeIndex, nominee] of nominees.entries()) {
            const item = `${location}, номинант № ${nomineeIndex + 1}`;
            if (!isRecord(nominee)) throw new Error(`${item}. Ожидается объект.`);
            const { name: rawName, ...fields } = nominee;
            const name = importName(rawName, item);
            validateFields(fields, nomineeFields, item);
            if (entry.knownNames.has(name)) entry.skipped++;
            else {
                entry.knownNames.add(name);
                entry.added++;
            }
        }
    }
    return {
        nominations: data.nominations,
        summary: [...summary.values()].map(({ title, create, added, skipped }) => ({ title, create, added, skipped })),
    };
}
