import pool from '../../database/db.js';
import { parseId } from '../../middleware/parseId.js';
import { AdminError, boolean, choice, validateFields, integer, invalid, notFound, string, url } from '../admin/adminValidation.js';
import { recordAudit, runAdminChange, updateFields } from '../admin/adminChanges.js';

const contentFields = { description: string(1200), image_url: url(true),
    sort_order: integer(-2147483648, 2147483647), archived: boolean };
const nominationFields = { title: string(160, true), status: choice(['draft', 'open', 'closed']), ...contentFields };
function optionalText(max) {
    const validate = string(max);
    return (value) => value === null ? null : validate(value);
}

const nomineeFields = { name: string(160, true), nomination_id: integer(1, 2147483647),
    handle: optionalText(100), song: optionalText(200), image_alt: optionalText(300),
    audio_url: url(true), link_url: url(), ...contentFields };
async function readCatalog() {
    const { rows } = await pool.query(`
        SELECT n.id, n.title, n.description, n.status, n.sort_order, n.archived, n.image_url,
            coalesce(json_agg(json_build_object(
                'id', m.id, 'nomination_id', m.nomination_id, 'name', m.name, 'description', m.description,
                'image_url', m.image_url, 'image_alt', m.image_alt, 'audio_url', m.audio_url, 'link_url', m.link_url,
                'handle', m.handle, 'song', m.song, 'sort_order', m.sort_order, 'archived', m.archived
            ) ORDER BY m.sort_order, m.id) FILTER (WHERE m.id IS NOT NULL), '[]'::json) AS nominees
        FROM nominations n LEFT JOIN nominees m ON m.nomination_id = n.id
        GROUP BY n.id ORDER BY n.sort_order, n.id
    `);
    return rows;
}

export async function getAdminCatalog(_req, res) {
    return res.json({ data: await readCatalog() });
}

const nomination = { type: 'nomination', table: 'nominations', label: 'Номинация' };
const nominee = { type: 'nominee', table: 'nominees', label: 'Номинант' };

async function checkCatalogEditable(client) {
    const { rows: [settings] } = await client.query('SELECT results_published FROM settings WHERE id = 1 FOR SHARE');
    if (settings.results_published) {
        throw new AdminError(409, 'results_published', 'Снимите результаты с публикации, чтобы изменить каталог.');
    }
}

async function checkNomination(client, id) {
    const result = await client.query('SELECT id FROM nominations WHERE id = $1 FOR KEY SHARE', [id]);
    if (!result.rowCount) notFound('Номинация');
}

async function createContent(client, actorId, { type, table }, values) {
    const columns = Object.keys(values);
    const parameters = columns.map((_, index) => `$${index + 1}`).join(', ');
    const { rows: [row] } = await client.query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${parameters}) RETURNING *`, Object.values(values),
    );
    await recordAudit(client, actorId, `${type}.created`, type, row.id, values);
    return row;
}

async function changeContent(client, actorId, { type, table, label }, id, values) {
    // Lock the destination before a nominee row, in the same order used for voting.
    if (type === 'nominee' && values.nomination_id) await checkNomination(client, values.nomination_id);
    const { rows: [before] } = await client.query(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [id]);
    if (!before) notFound(label);
    const { row, details } = await updateFields(client, table, id, before, values);
    await recordAudit(client, actorId, `${type}.updated`, type, id, details);
    return row;
}

function exportFields(row, fields) {
    return Object.fromEntries(Object.keys(fields).filter(key => key !== 'nomination_id').map(key => [key, row[key]]));
}

export async function exportCatalog(_req, res) {
    const nominations = (await readCatalog()).map(nomination => ({
        ...exportFields(nomination, nominationFields),
        nominees: nomination.nominees.map(nominee => exportFields(nominee, nomineeFields)),
    }));
    res.attachment('itd-awards-catalog.json').json({ schema: 1, nominations });
}

export async function bulkEditCatalog(req, res) {
    return runAdminChange(req, res, async (client) => {
        const { confirmed, nominations = [], nominees = [] } = req.body ?? {};
        if (confirmed !== true || !Array.isArray(nominations) || !Array.isArray(nominees)
            || (!nominations.length && !nominees.length) || nominations.length + nominees.length > 50) {
            invalid('Выберите от 1 до 50 записей и подтвердите изменение.');
        }
        const nominationChanges = parseBulkChanges(nominations, nominationFields);
        const nomineeChanges = parseBulkChanges(nominees, nomineeFields);
        await checkCatalogEditable(client);
        for (const { id, values } of nominationChanges) {
            await changeContent(client, req.user.id, nomination, id, values);
        }
        for (const { id, values } of nomineeChanges) {
            await changeContent(client, req.user.id, nominee, id, values);
        }
        return { data: { nominations: nominations.length, nominees: nominees.length } };
    });
}

const importNomineeFields = Object.fromEntries(Object.entries(nomineeFields).filter(([name]) => name !== 'nomination_id'));
export async function importCatalog(req, res) {
    return runAdminChange(req, res, async (client) => {
        const { schema, nominations, confirmed } = req.body ?? {};
        if (schema !== 1 || confirmed !== true || !Array.isArray(nominations) || !nominations.length || nominations.length > 60) {
            invalid('Проверьте формат каталога (версия 1), укажите от 1 до 60 номинаций и подтвердите импорт.');
        }
        let totalNominees = 0;
        const catalogue = nominations.map(entry => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid();
            const { nominees = [], ...fields } = entry;
            if (!Array.isArray(nominees)) invalid();
            totalNominees += nominees.length;
            if (totalNominees > 600) invalid('За один импорт можно добавить до 600 номинантов.');
            return { values: validateFields(fields, nominationFields, { required: ['title'] }),
                nominees: nominees.map(row => validateFields(row, importNomineeFields, { required: ['name'] })) };
        });
        await checkCatalogEditable(client);
        const result = { added_nominations: 0, added_nominees: 0, skipped_nominees: 0 };

        for (const { values, nominees } of catalogue) {
            const { rows } = await client.query('SELECT id FROM nominations WHERE title = $1', [values.title]);
            if (rows.length > 1) throw new AdminError(409, 'ambiguous_nomination', `Уточните дублирующие номинации «${values.title}».`);
            let existingNomination = rows[0];
            if (!existingNomination) {
                existingNomination = await createContent(client, req.user.id, nomination, { ...values, status: 'draft' });
                result.added_nominations++;
            }
            const { rows: existing } = await client.query('SELECT name FROM nominees WHERE nomination_id = $1', [existingNomination.id]);
            const names = new Set(existing.map(row => row.name));
            for (const participant of nominees) {
                if (names.has(participant.name)) {
                    result.skipped_nominees++;
                    continue;
                }
                await createContent(client, req.user.id, nominee, { ...participant, nomination_id: existingNomination.id });
                names.add(participant.name);
                result.added_nominees++;
            }
        }
        return { data: result, status: 201 };
    });
}

function parseBulkChanges(entries, fields) {
    const ids = new Set();
    const changes = [];
    for (const entry of entries) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid();
        const { id, ...patch } = entry;
        integer(1, 2147483647)(id);
        if (ids.has(id)) invalid('В выборке есть повторяющиеся записи.');
        ids.add(id);
        changes.push({ id, values: validateFields(patch, fields) });
    }
    return changes;
}

function readRecordId(req) {
    const id = parseId(req.params.id);
    if (id === null) invalid('Некорректный идентификатор.');
    return id;
}

async function deleteContent(client, actorId, { table, type, label }, id) {
    await checkCatalogEditable(client);
    const { rows: [removed] } = await client.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
    if (!removed) notFound(label);
    await recordAudit(client, actorId, `${type}.deleted`, type, id, removed);
    return { data: { id } };
}

export async function createNomination(req, res) {
    return runAdminChange(req, res, async (client) => {
        const values = validateFields(req.body, nominationFields, { required: ['title'] });
        await checkCatalogEditable(client);
        const row = await createContent(client, req.user.id, nomination, values);
        return { data: row, status: 201 };
    });
}

export async function updateNomination(req, res) {
    return runAdminChange(req, res, async (client) => {
        const id = readRecordId(req);
        const values = validateFields(req.body, nominationFields);
        await checkCatalogEditable(client);
        const row = await changeContent(client, req.user.id, nomination, id, values);
        return { data: row };
    });
}

export async function deleteNomination(req, res) {
    return runAdminChange(req, res, async (client) => {
        return deleteContent(client, req.user.id, nomination, readRecordId(req));
    });
}

export async function createNominee(req, res) {
    return runAdminChange(req, res, async (client) => {
        const values = validateFields(req.body, nomineeFields, { required: ['name', 'nomination_id'] });
        await checkCatalogEditable(client);
        await checkNomination(client, values.nomination_id);
        const row = await createContent(client, req.user.id, nominee, values);
        return { data: row, status: 201 };
    });
}

export async function updateNominee(req, res) {
    return runAdminChange(req, res, async (client) => {
        const id = readRecordId(req);
        const values = validateFields(req.body, nomineeFields);
        await checkCatalogEditable(client);
        const row = await changeContent(client, req.user.id, nominee, id, values);
        return { data: row };
    });
}

export async function deleteNominee(req, res) {
    return runAdminChange(req, res, async (client) => {
        return deleteContent(client, req.user.id, nominee, readRecordId(req));
    });
}
