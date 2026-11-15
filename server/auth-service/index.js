import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { accountRouter } from './accounts.js';
import db from './db.js';

if (process.connected) process.once('disconnect', () => process.exit());

function readOrigin(value) {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.href !== `${url.origin}/` || (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:'))) {
        throw new Error('Auth origins must use HTTPS or local HTTP and have no path.');
    }
    return url.origin;
}

const { PUBLIC_ORIGIN, AUTH_ALLOWED_ORIGINS, AUTH_INTERNAL_SECRET } = process.env;
if (!PUBLIC_ORIGIN || !AUTH_INTERNAL_SECRET || AUTH_INTERNAL_SECRET.length < 32) {
    throw new Error('Configure PUBLIC_ORIGIN and AUTH_INTERNAL_SECRET (32+ characters).');
}

const publicOrigin = readOrigin(PUBLIC_ORIGIN);
const allowedOrigins = [publicOrigin, ...(AUTH_ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim())
    .filter(Boolean).map(readOrigin)];
if (allowedOrigins.some((origin) => new URL(origin).protocol !== new URL(publicOrigin).protocol)) {
    throw new Error('AUTH_ALLOWED_ORIGINS must use the same protocol as PUBLIC_ORIGIN.');
}

db.on('error', () => console.error('Auth database connection lost.'));

const app = express();
const port = process.env.AUTH_PORT || 5050;
const sessionCookie = 'itd_awards_session';
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');
const sessionOptions = { httpOnly: true, sameSite: 'lax', secure: publicOrigin.startsWith('https:'), path: '/' };

function readCookie(req, name) {
    const pair = req.get('cookie')?.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
    const value = pair?.slice(name.length + 1);
    return tokenPattern.test(value ?? '') ? value : null;
}

function returnPath(value) {
    if (typeof value !== 'string' || !/^\/(?![\/\\])[^\\\r\n]*$/.test(value) || value.length > 1024) return '/';
    const url = new URL(value, publicOrigin);
    if (url.origin !== publicOrigin) return '/';
    if (!/^\/(?:nominations(?:\/[a-z0-9-]+)?\/?|my-votes\/?|results\/?|about\/?|ceremony\/?)?$/.test(url.pathname)) return '/';
    return url.pathname + url.search + url.hash;
}

async function createSession(req, voterId, client = db) {
    const token = newToken();
    const previous = readCookie(req, sessionCookie);
    await client.query(`
        WITH revoked AS (
            DELETE FROM auth_sessions WHERE expires_at <= now() OR token_hash = $1
        )
        INSERT INTO auth_sessions (token_hash, voter_id, expires_at)
        VALUES ($2, $3, now() + interval '1 day')
    `, [previous ? digest(previous) : null, digest(token), voterId]);
    return token;
}

function setSessionCookie(res, token) {
    res.cookie(sessionCookie, token, { ...sessionOptions, maxAge: 86_400_000 });
}

app.disable('x-powered-by');
app.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
});

app.use('/auth', accountRouter(db, allowedOrigins, { createSession, setSessionCookie }));

app.get('/auth/login', (req, res) => {
    const query = new URLSearchParams({ return_to: returnPath(req.query.return_to) });
    return res.redirect(303, `/sign-in?${query}`);
});

app.post('/auth/logout', async (req, res) => {
    if (!allowedOrigins.includes(req.get('origin'))) return res.sendStatus(403);
    const session = readCookie(req, sessionCookie);
    if (session) await db.query('DELETE FROM auth_sessions WHERE token_hash = $1', [digest(session)]);
    res.clearCookie(sessionCookie, sessionOptions);
    res.sendStatus(204);
});

app.get('/internal/session', async (req, res) => {
    const actual = Buffer.from(digest(req.get('authorization') ?? ''), 'hex');
    const expected = Buffer.from(digest(`Bearer ${AUTH_INTERNAL_SECRET}`), 'hex');
    if (!timingSafeEqual(actual, expected)) return res.sendStatus(403);
    const token = readCookie(req, sessionCookie);
    if (!token) return res.json({ voterId: null });
    const { rows: [session] } = await db.query(
        `SELECT s.voter_id FROM auth_sessions s
         JOIN auth_accounts a ON a.voter_id = s.voter_id
         WHERE s.token_hash = $1 AND s.expires_at > now()
           AND (a.provider_origin = 'email'
                OR EXISTS (SELECT 1 FROM auth_passwords p WHERE p.voter_id = s.voter_id))`, [digest(token)],
    );
    res.json({ voterId: session?.voter_id ?? null });
});

app.get('/health', (_req, res) => res.sendStatus(204));
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Auth request failed.');
    if (req.path.startsWith('/auth/email/') || req.path === '/auth/sign-in') {
        if (error.type === 'entity.parse.failed') {
            return res.status(400).json({ error: { code: 'invalid_json', message: 'Тело запроса должно быть корректным JSON.' } });
        }
        if (error.type === 'entity.too.large') {
            return res.status(413).json({ error: { code: 'payload_too_large', message: 'Слишком большой запрос.' } });
        }
        return res.status(503).json({ error: { code: 'auth_unavailable', message: 'Вход и регистрация сейчас недоступны. Попробуйте позже.' } });
    }
    res.sendStatus(503);
});

try {
    await db.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    app.listen(port, '127.0.0.1', async (error) => {
        if (error) {
            console.error('Auth listen failed:', error.code);
            await db.end();
            process.exitCode = 1;
            if (process.connected) process.disconnect();
            return;
        }
        console.log(`ITD Awards Auth — http://127.0.0.1:${port}`);
    });
} catch (error) {
    console.error('Auth database initialization failed:', error.code ?? error.name);
    await db.end();
    process.exitCode = 1;
    if (process.connected) process.disconnect();
}
