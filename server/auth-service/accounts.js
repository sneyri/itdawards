import { scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { json, Router } from 'express';
import { emailHandlers } from './email.js';

const deriveKey = promisify(scrypt);
const passwordOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function readUsername(value) {
    if (typeof value !== 'string') return null;
    const username = value.trim().replace(/^@/, '').toLowerCase();
    return /^[a-z0-9_][a-z0-9_.-]{0,31}$/.test(username) ? username : null;
}

function validPassword(value) {
    if (typeof value !== 'string') return false;
    const length = [...value].length;
    return length >= 15 && length <= 128;
}

function fail(res, status, code, message) {
    return res.status(status).json({ error: { code, message } });
}

export function accountRouter(db, allowedOrigins, { createSession, setSessionCookie }) {
    const router = Router();

    const credentials = [(req, res, next) => {
        if (!allowedOrigins.includes(req.get('origin'))) {
            return fail(res, 403, 'origin_forbidden', 'Запрос с этого сайта запрещён.');
        }
        if (!req.is('application/json')) {
            return fail(res, 415, 'unsupported_payload', 'Ожидается запрос в формате JSON.');
        }
        next();
    }, json({ limit: '8kb' })];

    const { requestCode, verifyCode } = emailHandlers(db, createSession, setSessionCookie);
    router.post('/email/request', ...credentials, requestCode);
    router.post('/email/verify', ...credentials, verifyCode);

    router.post('/sign-in', ...credentials, async (req, res) => {
        const username = readUsername(req.body?.username);
        const password = req.body?.password;
        if (!username || !validPassword(password)) {
            return fail(res, 401, 'invalid_credentials', 'Неверный ник или пароль.');
        }
        const { rows: [account] } = await db.query(
            'SELECT voter_id, password_hash FROM auth_passwords WHERE username = $1', [username],
        );
        const [salt, stored] = account ? account.password_hash.split(':') : ['0'.repeat(32), '0'.repeat(128)];
        const hash = await deriveKey(password, salt, 64, passwordOptions);
        if (!timingSafeEqual(hash, Buffer.from(stored, 'hex')) || !account) {
            return fail(res, 401, 'invalid_credentials', 'Неверный ник или пароль.');
        }
        setSessionCookie(res, await createSession(req, account.voter_id));
        return res.json({ data: { signedIn: true } });
    });

    return router;
}
