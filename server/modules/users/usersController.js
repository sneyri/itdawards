import pool from '../../database/db.js';
import { sendError } from '../../middleware/errorHandler.js';
import { parseTelegramId } from '../auth/telegramAuth.js';
import { auditQuery } from '../admin/audit.js';
import { AdminError, boolean, choice, validateFields, invalid, notFound } from '../admin/adminValidation.js';
import { recordAudit, runAdminChange, updateFields } from '../admin/adminChanges.js';

const participantRoles = ['USER', 'JURY'];
const roles = [...participantRoles, 'MANAGER', 'SUPERADMIN'];
const pageSize = 50;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

const userColumns = 'id, telegram_id::text, username, display_name, role, blocked, created_at, last_login_at';
const userSort = {
    created_desc: 'created_at DESC, id',
    created_asc: 'created_at, id',
    name_asc: 'lower(display_name), id',
    last_login_desc: 'last_login_at DESC NULLS LAST, id',
    role_asc: 'role, lower(display_name), id',
};

export async function listUsers(req, res) {
    const { telegram_id: telegramId, q, role, blocked, activity, sort = 'created_desc', offset = '0' } = req.query;
    if (telegramId !== undefined && !parseTelegramId(telegramId)) {
        return sendError(res, 400, 'invalid_input', 'Укажите точный числовой Telegram ID.');
    }
    if ((q !== undefined && (typeof q !== 'string' || q.length > 120 || q.includes('\0')))
        || (role !== undefined && !roles.includes(role))
        || (blocked !== undefined && !['true', 'false'].includes(blocked))
        || (activity !== undefined && !['recent', 'inactive', 'never'].includes(activity))
        || typeof sort !== 'string' || !Object.hasOwn(userSort, sort)
        || typeof offset !== 'string' || !/^\d{1,8}$/.test(offset)) {
        return sendError(res, 400, 'invalid_input', 'Проверьте параметры поиска.');
    }
    const { rows } = await pool.query(`
        SELECT ${userColumns} FROM users
        WHERE ($1::boolean OR role IN ('USER', 'JURY'))
            AND ($2::bigint IS NULL OR telegram_id = $2)
            AND ($3::text IS NULL OR strpos(lower(display_name), lower($3)) > 0
                OR strpos(lower(username), lower($3)) > 0 OR telegram_id::text = $3 OR id::text = lower($3))
            AND ($4::text IS NULL OR role = $4)
            AND ($5::boolean IS NULL OR blocked = $5)
            AND ($7::text IS NULL
                OR ($7 = 'recent' AND last_login_at >= now() - interval '30 days')
                OR ($7 = 'inactive' AND last_login_at < now() - interval '30 days')
                OR ($7 = 'never' AND last_login_at IS NULL))
        ORDER BY ${userSort[sort]} LIMIT ${pageSize} OFFSET $6
    `, [req.user.role === 'SUPERADMIN', telegramId, q?.trim() || null, role, blocked, Number(offset), activity]);
    res.json({ data: rows });
}

export async function getUser(req, res) {
    const id = req.params.id.toLowerCase();
    if (!uuid.test(id)) return sendError(res, 400, 'invalid_input', 'Некорректный идентификатор.');
    const owner = req.user.role === 'SUPERADMIN';
    const { rows: [user] } = await pool.query(`
        SELECT ${userColumns} FROM users WHERE id = $1 AND ($2::boolean OR role IN ('USER', 'JURY'))
    `, [id, owner]);
    if (!user) return sendError(res, 404, 'not_found', 'Пользователь не найден.');
    const [{ rows: history }, { rows: participation }] = await Promise.all([
        pool.query(`${auditQuery(`WHERE (a.target_type = 'user' AND a.target_id = $1::text)
            OR ($2::boolean AND a.actor_id = $1::text::uuid)`)} LIMIT ${pageSize}`, [id, owner]),
        pool.query(`
            SELECT v.nomination_id, n.title, v.created_at AS voted_at, nominee.name AS nominee_name
            FROM votes v JOIN nominations n ON n.id = v.nomination_id
            LEFT JOIN nominees nominee ON nominee.id = v.nominee_id
                AND nominee.nomination_id = v.nomination_id AND v.voter_role = 'USER'
            WHERE v.user_id = $1 AND v.voter_role IS NOT NULL ORDER BY v.created_at DESC, v.nomination_id
        `, [id]),
    ]);
    res.json({ data: { user, history, participation } });
}

export async function updateUser(req, res) {
    return runAdminChange(req, res, async (client, actor) => {
        const id = req.params.id.toLowerCase();
        if (!uuid.test(id)) invalid('Некорректный идентификатор.');
        if (id === req.user.id) throw new AdminError(409, 'own_account', 'Изменить свою роль или блокировку нельзя.');
        const values = validateFields(req.body, { role: choice(roles), blocked: boolean }, { confirmation: true });
        const { rows: [before] } = await client.query(`
            SELECT ${userColumns} FROM users WHERE id = $1 FOR UPDATE
        `, [id]);
        if (!before) notFound('Пользователь');
        if (actor.role === 'MANAGER' && (!participantRoles.includes(before.role)
            || (values.role && !participantRoles.includes(values.role)))) {
            throw new AdminError(403, 'forbidden', 'Администратор может управлять участниками и жюри.');
        }
        const { details } = await updateFields(client, 'users', id, before, values);
        if (details?.blocked?.after) {
            await client.query('UPDATE auth_codes SET used_at = clock_timestamp() WHERE user_id = $1 AND used_at IS NULL', [id]);
            await client.query('DELETE FROM sessions WHERE user_id = $1', [id]);
        }
        await recordAudit(client, req.user.id, 'user.updated', 'user', id, details);
        return { data: { ...before, ...values } };
    });
}
