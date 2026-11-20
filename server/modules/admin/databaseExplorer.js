import pool from '../../database/db.js';
import { sendError } from '../../middleware/errorHandler.js';
import { sendCsv } from './exportCsv.js';

// These projections are the entire data surface. SQL identifiers come only from this allowlist.
const descriptors = [
    { id: 'nominations', label: 'Номинации', edit_path: '/admin#catalog',
        fields: { id: 'integer', title: 'text', description: 'text', status: 'text', sort_order: 'integer', archived: 'boolean', created_at: 'timestamptz' } },
    { id: 'nominees', label: 'Номинанты', edit_path: '/admin#catalog',
        fields: { id: 'integer', nomination_id: 'integer', name: 'text', description: 'text', link_url: 'text', image_url: 'text',
            sort_order: 'integer', archived: 'boolean', created_at: 'timestamptz' } },
    { id: 'settings', label: 'Параметры голосования', edit_path: '/admin#voting',
        fields: { id: 'smallint', voting_open: 'boolean', opens_at: 'timestamptz', closes_at: 'timestamptz',
            allow_vote_changes: 'boolean', jury_weight: 'integer', results_published: 'boolean' } },
    { id: 'invitation_codes', label: 'Приглашения', edit_path: '/admin#invitations',
        fields: { id: 'uuid', role: 'text', created_at: 'timestamptz', expires_at: 'timestamptz',
            max_uses: 'integer', use_count: 'integer', revoked_at: 'timestamptz' } },
    { id: 'audit_logs', label: 'События аудита', edit_path: null,
        fields: { id: 'bigint', action: 'text', target_type: 'text', created_at: 'timestamptz' } },
];

function displayTable(descriptor, total) {
    const { id, label, fields, edit_path } = descriptor;
    return { id, label, columns: Object.entries(fields).map(([name, type]) => ({ name, type })), count: total, edit_path };
}

export async function listTables(_req, res) {
    const tables = await Promise.all(descriptors.map(async descriptor => {
        const { rows: [row] } = await pool.query(`SELECT count(*)::int AS total FROM ${descriptor.id}`);
        return displayTable(descriptor, row.total);
    }));
    res.json({ data: tables });
}

export function parsePage(query) {
    const { limit = '30', offset = '0' } = query;
    if (typeof offset !== 'string' || !/^\d{1,8}$/.test(offset)
        || typeof limit !== 'string' || !/^\d{1,3}$/.test(limit)
        || Number(limit) < 1 || Number(limit) > 100) return null;
    return { limit: Number(limit), offset: Number(offset) };
}

export async function readTable(req, res) {
    const table = descriptors.find(entry => entry.id === req.params.id);
    if (!table) return sendError(res, 404, 'not_found', 'Таблица не доступна в обозревателе.');
    const page = parsePage(req.query);
    const { search = '', sort = 'id', direction = 'asc', format = 'json', column, value } = req.query;
    if (!page || typeof search !== 'string' || search.length > 160 || search.includes('\0')
        || typeof sort !== 'string' || !Object.hasOwn(table.fields, sort)
        || !['asc', 'desc'].includes(direction) || !['csv', 'json'].includes(format)
        || (column !== undefined && (typeof column !== 'string' || !Object.hasOwn(table.fields, column)))
        || ((column === undefined) !== (value === undefined))
        || (value !== undefined && (typeof value !== 'string' || value.length > 160 || value.includes('\0')))) {
        return sendError(res, 400, 'invalid_input', 'Проверьте фильтры и параметры сортировки.');
    }

    const columns = Object.keys(table.fields);
    const query = [search.trim()];
    const where = [`($1 = '' OR strpos(lower(concat_ws(' ', ${columns.join(', ')})), lower($1)) > 0)`];
    if (column !== undefined) {
        where.push(`${column}::text = $2`);
        query.push(value.trim());
    }
    const source = `FROM ${table.id} WHERE ${where.join(' AND ')}`;
    const stableOrder = sort === 'id' ? '' : ', id ASC';
    const order = `ORDER BY ${sort} ${direction.toUpperCase()} NULLS LAST${stableOrder}`;
    if (format === 'csv') {
        const { rows } = await pool.query(`SELECT ${columns.join(', ')} ${source} ${order} LIMIT 5001`, query);
        if (rows.length > 5000) return sendError(res, 400, 'export_too_large', 'Уточните фильтр. За раз можно экспортировать до 5000 записей.');
        return sendCsv(res, `itd-${table.id}.csv`, columns, rows);
    }
    const [{ rows: [count] }, { rows }] = await Promise.all([
        pool.query(`SELECT count(*)::int AS total ${source}`, query),
        pool.query(`SELECT ${columns.join(', ')} ${source} ${order} LIMIT $${query.length + 1} OFFSET $${query.length + 2}`,
            [...query, page.limit, page.offset]),
    ]);
    res.json({ data: { table: displayTable(table, count.total), rows, total: count.total, ...page } });
}
