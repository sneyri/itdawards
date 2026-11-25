import pool, { transaction } from '../../database/db.js';
import { sendError } from '../../middleware/errorHandler.js';
import { codeSecret } from '../../config.js';
import { CODE_TTL_SECONDS, loginCodeCooldown, storeLoginCode } from './loginCodes.js';

const invitationRoles = ['USER', 'JURY'];
const juryInvitationTtlSeconds = 100 * 365 * 24 * 3600;
const managerRoles = ['MANAGER', 'SUPERADMIN'];
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const pageSize = 100;
const invitationDetails = `SELECT i.id, i.role, i.created_at, i.expires_at, i.max_uses, i.use_count,
    i.revoked_at, i.account_id AS user_id, i.creator_id, creator.display_name AS creator_name,
    CASE WHEN i.revoked_at IS NOT NULL THEN 'revoked'
        WHEN i.use_count >= i.max_uses THEN 'used'
        WHEN code.used_at IS NOT NULL THEN 'revoked'
        WHEN i.account_id IS NULL OR (i.expires_at IS NOT NULL AND i.expires_at <= clock_timestamp())
        THEN 'expired' ELSE 'active' END AS status
    FROM invitation_codes i JOIN users creator ON creator.id = i.creator_id
    LEFT JOIN auth_codes code ON code.user_id = i.account_id AND code.invitation_id = i.id`;

export async function listInvitations(req, res) {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const { role = '', status = '' } = req.query;
    if (!Number.isInteger(page) || page < 1 || page > 10000 || Array.isArray(req.query.page)
        || !['', 'USER', 'JURY'].includes(role) || !['', 'active', 'used', 'revoked', 'expired'].includes(status)) {
        return sendError(res, 400, 'invalid_input', 'Некорректный номер страницы.');
    }
    const { rows } = await pool.query(`SELECT * FROM (${invitationDetails}) AS invitation
        WHERE ($1 = '' OR role = $1) AND ($2 = '' OR status = $2)
        ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`, [role, status, pageSize + 1, (page - 1) * pageSize]);
    return res.json({ data: rows.slice(0, pageSize), pagination: { page, hasMore: rows.length > pageSize } });
}

async function lockAdministrator(client, userId) {
    // Use the same lock as the role editor so a revoked role cannot finish an invitation write.
    await client.query('SELECT pg_advisory_xact_lock(2026, 2)');
    const { rows: [user] } = await client.query('SELECT role FROM users WHERE id = $1 AND NOT blocked FOR SHARE', [userId]);
    return managerRoles.includes(user?.role) ? user.role : null;
}

async function auditInvitation(client, actorId, action, invitationId, details) {
    await client.query(`
        INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
        VALUES ($1, $2, 'invitation', $3, $4)
    `, [actorId, action, invitationId, details]);
}

async function invitationById(client, invitationId) {
    const { rows: [invitation] } = await client.query(`${invitationDetails} WHERE i.id = $1`, [invitationId]);
    return invitation;
}

async function issueInvitation(client, actorId, user, action) {
    const ttlSeconds = user.role === 'JURY' ? juryInvitationTtlSeconds : CODE_TTL_SECONDS;
    const { rows: [invitation] } = await client.query(`
        INSERT INTO invitation_codes (account_id, role, creator_id, expires_at, max_uses, created_at)
        VALUES ($1, $2, $3, statement_timestamp() + make_interval(secs => $4), 1, statement_timestamp())
        RETURNING id
    `, [user.id, user.role, actorId, ttlSeconds]);
    const { code } = await storeLoginCode(client, user.id, invitation.id, ttlSeconds);
    await client.query(`
        UPDATE invitation_codes AS invitation SET expires_at = code.expires_at
        FROM auth_codes AS code WHERE invitation.id = $1 AND code.invitation_id = invitation.id
    `, [invitation.id]);
    await auditInvitation(client, actorId, action, invitation.id, { userId: user.id, role: user.role });
    return { ...await invitationById(client, invitation.id), code };
}

async function issueInvitations(req, res, count, bulk) {
    if (!codeSecret) return sendError(res, 503, 'auth_unavailable', 'Вход пока недоступен.');
    const { role, displayName, expiresAt, maxUses = 1 } = req.body ?? {};
    if (!invitationRoles.includes(role)) return sendError(res, 400, 'invalid_input', 'Укажите роль участника или жюри.');
    if (maxUses !== 1) return sendError(res, 400, 'invalid_input', 'Используйте один код на одного пользователя.');
    if (expiresAt !== undefined && (typeof expiresAt !== 'string' || !(Date.parse(expiresAt) > Date.now()))) {
        return sendError(res, 400, 'invalid_input', 'Дата окончания должна быть в будущем.');
    }
    const name = typeof displayName === 'string' ? displayName.trim() : '';
    if (displayName !== undefined && (!name || name.includes('\0') || [...name].length > 120 || bulk)) {
        return sendError(res, 400, 'invalid_input', 'Укажите имя приглашённого длиной до 120 символов.');
    }

    const invitations = await transaction(async (client) => {
        if (!await lockAdministrator(client, req.user.id)) return null;
        const issued = [];
        for (let index = 0; index < count; index++) {
            // Existing admin forms send only the role and legacy expiration settings.
            const { rows: [user] } = await client.query(`
                INSERT INTO users (display_name, role) VALUES ($1, $2) RETURNING id, role
            `, [name || 'Приглашённый участник', role]);
            issued.push(await issueInvitation(client, req.user.id, user, 'invitation.created'));
        }
        return issued;
    });
    if (!invitations) return sendError(res, 403, 'forbidden', 'Недостаточно прав для этой роли.');
    return res.status(201).json({ data: bulk ? invitations : invitations[0] });
}

export async function createInvitation(req, res) {
    return issueInvitations(req, res, 1, false);
}

export async function createInvitationBatch(req, res) {
    const { count, confirmed } = req.body ?? {};
    if (!Number.isInteger(count) || count < 1 || count > 25 || confirmed !== true) {
        return sendError(res, 400, 'invalid_input', 'Укажите число кодов от 1 до 25 и подтвердите выпуск.');
    }
    return issueInvitations(req, res, count, true);
}

export async function reissueInvitation(req, res) {
    const { userId } = req.params;
    if (!uuid.test(userId) || req.body?.confirmed !== true) {
        return sendError(res, 400, 'invalid_input', 'Укажите ID пользователя и подтвердите проверку личности.');
    }
    if (!codeSecret) return sendError(res, 503, 'auth_unavailable', 'Вход пока недоступен.');
    const result = await transaction(async (client) => {
        if (await lockAdministrator(client, req.user.id) !== 'SUPERADMIN') return { forbidden: true };
        const { rows: [user] } = await client.query(`
            SELECT id, role FROM users
            WHERE id = $1 AND telegram_id IS NULL AND NOT blocked AND role IN ('USER', 'JURY')
            FOR UPDATE
        `, [userId]);
        if (!user) return { forbidden: true };
        const retryAfter = await loginCodeCooldown(client, user.id);
        if (retryAfter) return { retryAfter };

        await client.query(`
            UPDATE invitation_codes SET revoked_at = clock_timestamp()
            WHERE account_id = $1 AND use_count = 0 AND revoked_at IS NULL
                AND (expires_at IS NULL OR expires_at > clock_timestamp())
        `, [user.id]);
        return { invitation: await issueInvitation(client, req.user.id, user, 'invitation.reissued') };
    });
    if (result.forbidden) return sendError(res, 403, 'forbidden', 'Выдача кода для этого аккаунта недоступна.');
    if (result.retryAfter) {
        res.set('Retry-After', String(result.retryAfter));
        return sendError(res, 429, 'code_cooldown', 'Запросить новый код можно раз в минуту.');
    }
    return res.status(201).json({ data: result.invitation });
}

export async function revokeInvitation(req, res) {
    const { id } = req.params;
    if (!uuid.test(id)) return sendError(res, 400, 'invalid_input', 'Некорректный идентификатор приглашения.');
    const result = await transaction(async (client) => {
        const actorRole = await lockAdministrator(client, req.user.id);
        if (!actorRole) return { forbidden: true };
        const invitation = await invitationById(client, id);
        if (!invitation) return { missing: true };
        if (actorRole !== 'SUPERADMIN' && invitation.creator_id !== req.user.id) return { forbidden: true };
        if (invitation.revoked_at) return { invitation };
        if (invitation.user_id) {
            // Login also locks the account before touching the code and invitation.
            await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [invitation.user_id]);
            await client.query(`
                UPDATE auth_codes SET used_at = clock_timestamp()
                WHERE invitation_id = $1 AND user_id = $2 AND used_at IS NULL
            `, [id, invitation.user_id]);
        }
        await client.query('UPDATE invitation_codes SET revoked_at = clock_timestamp() WHERE id = $1', [id]);
        await auditInvitation(client, req.user.id, 'invitation.revoked', invitation.id, { role: invitation.role });
        return { invitation: await invitationById(client, id) };
    });
    if (result.forbidden) return sendError(res, 403, 'forbidden', 'Недостаточно прав для отзыва приглашения.');
    if (result.missing) return sendError(res, 404, 'not_found', 'Приглашение не найдено.');
    return res.json({ data: result.invitation });
}

export async function listInvitationUses(req, res) {
    const { id } = req.params;
    if (!uuid.test(id)) return sendError(res, 400, 'invalid_input', 'Некорректный идентификатор приглашения.');
    const invitation = await invitationById(pool, id);
    if (!invitation) return sendError(res, 404, 'not_found', 'Приглашение не найдено.');
    if (req.user.role !== 'SUPERADMIN' && invitation.creator_id !== req.user.id) {
        return sendError(res, 403, 'forbidden', 'Недостаточно прав для просмотра приглашения.');
    }
    const { rows } = await pool.query(`
        SELECT u.user_id, participant.display_name, u.used_at FROM invitation_uses u
        JOIN users participant ON participant.id = u.user_id WHERE u.invitation_id = $1
        ORDER BY u.used_at DESC, u.user_id
    `, [id]);
    return res.json({ data: rows });
}
