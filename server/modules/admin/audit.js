import pool from '../../database/db.js';
import { sendError } from '../../middleware/errorHandler.js';
import { sendCsv } from './exportCsv.js';

const pageSize = 50;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function auditQuery(where) {
    return `SELECT a.id, a.action, a.target_type, a.target_id, a.details, a.created_at,
        u.id AS actor_id, u.display_name AS actor_display_name, u.telegram_id::text AS actor_telegram_id
        FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
        ${where} ORDER BY a.id DESC`;
}

function parseAuditDate(value) {
    if (typeof value !== 'string' || value.length > 35
        || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)) return null;
    const parsed = new Date(value);
    return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value.slice(0, 10)
        && !value.startsWith('0000') ? parsed : null;
}

export async function getAudit(req, res) {
    const { user_id: userId, before, search, from, to, level, format = 'json' } = req.query;
    if (userId !== undefined && (typeof userId !== 'string' || !uuid.test(userId))) {
        return sendError(res, 400, 'invalid_input', 'Некорректный идентификатор пользователя.');
    }
    if (before !== undefined && (typeof before !== 'string' || !/^[1-9]\d{0,18}$/.test(before)
        || BigInt(before) > 9223372036854775807n)) {
        return sendError(res, 400, 'invalid_input', 'Некорректная позиция журнала.');
    }
    const start = from === undefined ? null : parseAuditDate(from);
    const end = to === undefined ? null : parseAuditDate(to);
    if ((from !== undefined && !start) || (to !== undefined && !end) || (start && end && start > end)
        || (search !== undefined && (typeof search !== 'string' || search.length > 160 || search.includes('\0')))
        || (level !== undefined && !['info', 'warning'].includes(level)) || !['json', 'csv'].includes(format)) {
        return sendError(res, 400, 'invalid_input', 'Проверьте фильтры журнала.');
    }
    const endExclusive = typeof to === 'string' && to.length === 10 ? new Date(+end + 86_400_000) : end;
    const { rows } = await pool.query(`${auditQuery(`WHERE ($1::text IS NULL OR (a.target_type = 'user' AND a.target_id = $1))
        AND ($2::bigint IS NULL OR a.id < $2)
        AND ($3::timestamptz IS NULL OR a.created_at >= $3)
        AND ($4::timestamptz IS NULL OR a.created_at < $4)
        AND ($5::text IS NULL OR strpos(lower(concat_ws(' ', a.action, a.target_type, a.target_id, u.display_name)), lower($5)) > 0)
        AND ($6::text IS NULL OR (a.action = 'auth.rate_limited') = ($6 = 'warning'))`)} LIMIT $7`,
    [userId?.toLowerCase(), before, start, endExclusive, search?.trim() || null, level, format === 'csv' ? 5001 : pageSize + 1]);
    if (format === 'csv') {
        if (rows.length > 5000) return sendError(res, 400, 'export_too_large', 'Уточните период. За раз можно экспортировать до 5000 записей.');
        return sendCsv(res, 'itd-awards-audit.csv', ['id', 'created_at', 'action', 'actor_display_name', 'target_type', 'target_id'], rows);
    }
    const entries = rows.slice(0, pageSize);
    res.json({ data: { entries, next: rows.length > pageSize ? entries.at(-1).id : null } });
}
