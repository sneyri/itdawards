import { codeSecret } from '../../config.js';
import pool, { transaction } from '../../database/db.js';
import { sendError } from '../../middleware/errorHandler.js';
import { consumeLoginCode, parseCode } from './loginCodes.js';
import { authState, clearSession, saveSession, sessionHash, setSession } from './sessions.js';

function invalidCode(res) {
    return sendError(res, 400, 'invalid_code', 'Код недействителен. Запросите новый код.');
}

export async function login(req, res) {
    if (!codeSecret) return sendError(res, 503, 'auth_unavailable', 'Вход пока недоступен.');
    const code = parseCode(req.body?.code);
    if (!code) return invalidCode(res);

    const result = await transaction(async (client) => {
        const consumed = await consumeLoginCode(client, code);
        if (!consumed) return null;
        const { user, method } = consumed;
        return { user, token: await saveSession(client, req, user.id, method) };
    });

    if (!result) return invalidCode(res);
    setSession(res, result.token);
    req.user = result.user;
    return res.json({ data: authState(req) });
}

export async function logout(req, res) {
    const tokenHash = sessionHash(req);
    if (tokenHash) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    clearSession(res);
    return res.json({ data: authState(req) });
}

export function getCurrentSession(req, res) {
    return res.json({ data: authState(req) });
}

export function passwordLoginRetired(_req, res) {
    return sendError(res, 410, 'password_login_retired', 'Войдите на странице /sign-in по одноразовому коду.');
}
