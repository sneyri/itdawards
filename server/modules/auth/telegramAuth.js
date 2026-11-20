import { createHash, timingSafeEqual } from 'node:crypto';
import { botApiToken, codeSecret } from '../../config.js';
import pool, { transaction } from '../../database/db.js';
import { sendError } from '../../middleware/errorHandler.js';
import { CODE_TTL_SECONDS, loginCodeCooldown, storeLoginCode } from './loginCodes.js';

const MAX_TELEGRAM_ID = 4_503_599_627_370_495n;
const hashAuthorization = (header) => createHash('sha256').update(header).digest();
const botAuthorizationHash = botApiToken && hashAuthorization(`Bearer ${botApiToken}`);

export function requireBot(req, res, next) {
    const localConnection = ['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const browserOrProxy = req.get('origin') || req.get('forwarded') || req.get('x-forwarded-for');
    if (!localConnection || browserOrProxy || !botAuthorizationHash || !codeSecret
        || !timingSafeEqual(botAuthorizationHash, hashAuthorization(req.get('authorization') ?? ''))) {
        return sendError(res, 401, 'bot_unauthorized', 'Доступ разрешён только боту.');
    }
    next();
}

export function parseTelegramId(value) {
    if (typeof value !== 'string' || !/^[1-9]\d{0,15}$/.test(value)) return null;
    return BigInt(value) <= MAX_TELEGRAM_ID ? value : null;
}

export async function issueCode(req, res) {
    const telegramId = parseTelegramId(req.body?.telegramId);
    if (!telegramId) return sendError(res, 400, 'invalid_telegram_id', 'Некорректный Telegram ID.');
    const name = req.body.displayName;
    const displayName = typeof name === 'string'
        ? [...name.replace(/\u0000/g, '').trim()].slice(0, 120).join('')
        : '';
    const result = await transaction(async (client) => {
        // The upsert locks the user row before checking the cooldown or replacing their code.
        const { rows: [user] } = await client.query(`
            INSERT INTO users (telegram_id, display_name) VALUES ($1, $2)
            ON CONFLICT (telegram_id) DO UPDATE
                SET display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name)
            RETURNING id, blocked
        `, [telegramId, displayName]);
        if (user.blocked) return { blocked: true };
        const retryAfter = await loginCodeCooldown(client, user.id);
        if (retryAfter) return { retryAfter };
        return storeLoginCode(client, user.id);
    });
    if (result.blocked) return sendError(res, 403, 'account_blocked', 'Аккаунт заблокирован.');
    if (result.retryAfter) {
        res.set('Retry-After', String(result.retryAfter));
        return sendError(res, 429, 'code_cooldown', 'Запросить новый код можно раз в минуту.');
    }
    return res.json({ data: { code: result.code, expiresIn: CODE_TTL_SECONDS } });
}

export async function getLinkStatus(req, res) {
    const telegramId = parseTelegramId(req.body?.telegramId);
    if (!telegramId) return sendError(res, 400, 'invalid_telegram_id', 'Некорректный Telegram ID.');
    const { rows: [user] } = await pool.query(
        'SELECT last_login_at, blocked FROM users WHERE telegram_id = $1', [telegramId],
    );
    if (user?.blocked) return sendError(res, 403, 'account_blocked', 'Аккаунт заблокирован.');
    return res.json({ data: { linked: Boolean(user?.last_login_at) } });
}
