import { createHash, randomBytes } from 'node:crypto';
import pool, { isBotPreview } from '../../database/db.js';
import { botUrl, secureCookies } from '../../config.js';
import { sendError } from '../../middleware/errorHandler.js';
import { noteAccountActivity } from '../monitoring/telemetry.js';

export const SESSION_DAYS = 14;
const sessionCookie = isBotPreview ? 'itd_preview_session' : 'itd_session';
const cookieName = secureCookies ? `__Host-${sessionCookie}` : sessionCookie;
const cookieOptions = { httpOnly: true, secure: secureCookies, sameSite: 'strict', path: '/' };

export function hashSession(token) {
    return createHash('sha256').update(token).digest();
}

export function sessionHash(req) {
    const cookies = req.get('cookie')?.split(';') ?? [];
    const cookie = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
    const token = cookie?.slice(cookieName.length + 1);
    return /^[a-f0-9]{64}$/.test(token ?? '') ? hashSession(token) : null;
}

export function setSession(res, token) {
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: SESSION_DAYS * 86_400_000 });
}

export function clearSession(res) {
    res.clearCookie(cookieName, cookieOptions);
}

export async function saveSession(client, req, userId, method) {
    const token = randomBytes(32).toString('hex');
    await client.query('UPDATE users SET last_login_at = clock_timestamp() WHERE id = $1', [userId]);
    await client.query('DELETE FROM sessions WHERE (user_id = $1 AND expires_at <= now()) OR token_hash = $2',
        [userId, sessionHash(req)]);
    await client.query(
        'INSERT INTO sessions (token_hash, user_id, expires_at, method) VALUES ($1, $2, now() + make_interval(days => $3), $4)',
        [hashSession(token), userId, SESSION_DAYS, method],
    );
    await client.query('INSERT INTO login_events (user_id, method) VALUES ($1, $2)', [userId, method]);
    return token;
}

export async function readSession(req, _res, next) {
    req.user = null;
    const hash = sessionHash(req);
    if (hash) {
        const { rows: [user] } = await pool.query(`
            SELECT u.id, u.display_name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT u.blocked
        `, [hash]);
        req.user = user ?? null;
        if (user) noteAccountActivity(user.id);
    }
    next();
}

export function authState(req) {
    const user = req.user;
    return {
        user: user ? { id: user.id, displayName: user.display_name, role: user.role } : null,
        botUrl,
    };
}

export function requireSession(req, res, next) {
    if (!req.user) return sendError(res, 401, 'login_required', 'Войдите в аккаунт.');
    next();
}

export function requireRole(...roles) {
    return (req, res, next) => requireSession(req, res, () => {
        if (!roles.includes(req.user.role)) {
            return sendError(res, 403, 'forbidden', 'Недостаточно прав.');
        }
        next();
    });
}
