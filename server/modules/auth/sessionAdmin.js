import pool, { transaction } from '../../database/db.js';
import { sessionHash } from './sessions.js';
import { sendError } from '../../middleware/errorHandler.js';
import { accountActivityAt, failedAttemptSummary } from '../monitoring/telemetry.js';
import { parsePage } from '../admin/databaseExplorer.js';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const securityAudit = "(a.action IN ('auth.rate_limited', 'user.updated', 'account.recovered', 'session.revoked') OR a.target_type = 'invitation')";

export async function securitySummary(_req, res) {
    const [{ rows: [accounts] }, { rows: recent }] = await Promise.all([
        pool.query(`SELECT (SELECT count(*)::int FROM users WHERE blocked) AS blocked_users,
            (SELECT count(*)::int FROM sessions s JOIN users u ON u.id = s.user_id
                WHERE s.expires_at > now() AND NOT u.blocked) AS active_sessions`),
        pool.query(`SELECT a.id, a.action, a.target_type, a.target_id, a.created_at, a.details, a.actor_id,
            u.display_name AS actor_display_name, u.telegram_id::text AS actor_telegram_id
            FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
            WHERE ${securityAudit} ORDER BY a.id DESC LIMIT 40`),
    ]);
    res.json({ data: { ...accounts, ...failedAttemptSummary(), recent } });
}

export async function accountSessions(req, res) {
    const id = req.params.id;
    if (!uuid.test(id)) return sendError(res, 400, 'invalid_input', 'Некорректный идентификатор пользователя.');
    const { rows: [user] } = await pool.query(`SELECT id, display_name, role, last_login_at,
        CASE WHEN telegram_id IS NOT NULL THEN 'telegram' ELSE 'invitation' END AS registration_method
        FROM users WHERE id = $1`, [id]);
    if (!user) return sendError(res, 404, 'not_found', 'Пользователь не найден.');
    const [{ rows: sessions }, { rows: logins }] = await Promise.all([
        pool.query(`SELECT id, created_at, expires_at, method, token_hash = $2 AS current FROM sessions
            WHERE user_id = $1 AND expires_at > now() ORDER BY created_at DESC NULLS LAST, id`, [id, sessionHash(req)]),
        pool.query(`SELECT method, created_at AS at FROM login_events
            WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50`, [id]),
    ]);
    res.json({ data: { user: { ...user, last_activity_at: accountActivityAt(user.id) }, sessions, logins } });
}

export async function listSessions(req, res) {
    const page = parsePage(req.query);
    if (!page) return sendError(res, 400, 'invalid_input', 'Проверьте параметры страницы.');
    const filter = 'FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.expires_at > now() AND NOT u.blocked';
    const [{ rows: [count] }, { rows: sessions }] = await Promise.all([
        pool.query(`SELECT count(*)::int AS total ${filter}`),
        pool.query(`SELECT s.id, s.user_id, u.display_name, u.role, s.created_at, s.expires_at, s.method, s.token_hash = $1 AS current
            ${filter} ORDER BY s.created_at DESC NULLS LAST, s.id LIMIT $2 OFFSET $3`, [sessionHash(req), page.limit, page.offset]),
    ]);
    res.json({ data: { sessions, total: count.total, ...page } });
}

export async function revokeSession(req, res) {
    const { userId, sessionId } = req.params;
    if (!uuid.test(userId) || !uuid.test(sessionId) || req.body?.confirmed !== true) {
        return sendError(res, 400, 'invalid_input', 'Подтвердите завершение выбранного сеанса.');
    }
    const currentSession = sessionHash(req);
    const outcome = await transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(2026, 2)');
        const { rowCount: permitted } = await client.query(`SELECT u.id FROM users u
            JOIN sessions s ON s.user_id = u.id AND s.token_hash = $2 AND s.expires_at > now()
            WHERE u.id = $1 AND u.role = 'SUPERADMIN' AND NOT u.blocked FOR SHARE OF u`, [req.user.id, currentSession]);
        if (!permitted) return 'forbidden';
        const { rows: [target] } = await client.query(`SELECT token_hash = $3 AS current FROM sessions
            WHERE user_id = $1 AND id = $2 AND expires_at > now() FOR UPDATE`, [userId, sessionId, currentSession]);
        if (!target) return 'not_found';
        if (target.current) return 'current_session';
        await client.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
        await client.query(`INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
            VALUES ($1, 'session.revoked', 'user', $2, $3)`, [req.user.id, userId, { sessionId }]);
        return 'revoked';
    });
    if (outcome === 'forbidden') return sendError(res, 403, outcome, 'Недостаточно прав.');
    if (outcome === 'not_found') return sendError(res, 404, outcome, 'Сеанс больше не активен.');
    if (outcome === 'current_session') return sendError(res, 409, outcome, 'Текущий сеанс можно завершить кнопкой выхода.');
    return res.json({ data: { revoked: true } });
}
