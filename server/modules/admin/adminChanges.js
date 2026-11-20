import { transaction } from '../../database/db.js';
import { sendError } from '../../middleware/errorHandler.js';
import { AdminError } from './adminValidation.js';

export async function updateFields(client, table, id, before, proposed) {
    const changes = Object.entries(proposed).filter(([key, value]) => {
        const previous = before[key];
        return previous instanceof Date && value instanceof Date ? +previous !== +value : previous !== value;
    });
    if (!changes.length) return { row: before, details: null };
    // Table names and column names originate from the route and its input allowlist.
    const assignments = changes.map(([column], index) => `${column} = $${index + 1}`).join(', ');
    const { rows: [row] } = await client.query(
        `UPDATE ${table} SET ${assignments} WHERE id = $${changes.length + 1} RETURNING *`,
        [...changes.map(([, value]) => value), id],
    );
    const details = Object.fromEntries(changes.map(([key]) => [key, { before: before[key], after: row[key] }]));
    return { row, details };
}

export async function recordAudit(client, actor, action, targetType, targetId, details) {
    if (!details) return;
    await client.query(`
        INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
        VALUES ($1, $2, $3, $4, $5)
    `, [actor, action, targetType, String(targetId), details]);
}

export async function runAdminChange(req, res, change) {
    try {
        const { data, status = 200 } = await transaction(async (client) => {
            // Serialize administrative writes, including changes between two administrators' accounts.
            await client.query('SELECT pg_advisory_xact_lock(2026, 2)');
            const { rows: [actor] } = await client.query(
                'SELECT role, blocked FROM users WHERE id = $1 FOR SHARE', [req.user.id],
            );
            if (!actor || actor.blocked || !['MANAGER', 'SUPERADMIN'].includes(actor.role)) {
                throw new AdminError(403, 'forbidden', 'Недостаточно прав.');
            }
            return change(client, actor);
        });
        return res.status(status).json({ data });
    } catch (error) {
        if (error instanceof AdminError) return sendError(res, error.status, error.code, error.message);
        if (error.code === '23503') {
            return sendError(res, 409, 'related_votes', 'Запись связана с голосами. Её можно скрыть.');
        }
        throw error;
    }
}
