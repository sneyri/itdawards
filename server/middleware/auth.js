import { sendError } from './errorHandler.js';
import { anonymousVoting } from './anonymousVoter.js';

const serviceUrl = process.env.AUTH_SERVICE_URL;
const secret = process.env.AUTH_INTERNAL_SECRET;
const accountAuthEnabled = Boolean(serviceUrl && secret);
export const demoVoting = !serviceUrl && !secret && process.argv.includes('--bot-preview');
const sessionCookie = /(?:^|;\s*)itd_awards_session=[A-Za-z0-9_-]{43}(?=;|$)/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (Boolean(serviceUrl) !== Boolean(secret) || (secret && secret.length < 32)) {
    throw new Error('Configure AUTH_SERVICE_URL and AUTH_INTERNAL_SECRET (32+ characters) together.');
}
if (serviceUrl) {
    const url = new URL(serviceUrl);
    if (url.href !== `${url.origin}/` || !['http:', 'https:'].includes(url.protocol)
        || (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) {
        throw new Error('AUTH_SERVICE_URL must be a loopback HTTP or HTTPS origin.');
    }
}

export function authState(req) {
    return {
        mode: anonymousVoting ? 'anonymous' : demoVoting ? 'demo' : accountAuthEnabled ? 'account' : 'unavailable',
        signedIn: !anonymousVoting && accountAuthEnabled && Boolean(req.voterId),
        available: !req.authUnavailable,
    };
}

export async function readSession(req, _res, next) {
    req.voterId = null;
    const cookie = req.get('cookie')?.match(sessionCookie)?.[0].replace(/^;\s*/, '');
    if (accountAuthEnabled && cookie) {
        try {
            const response = await fetch(new URL('/internal/session', serviceUrl), {
                headers: { Authorization: `Bearer ${secret}`, Cookie: cookie },
                redirect: 'error',
                signal: AbortSignal.timeout(4000),
            });
            if (!response.ok) throw new Error('Session lookup failed');
            const { voterId } = await response.json();
            if (voterId !== null && (typeof voterId !== 'string' || !uuid.test(voterId))) {
                throw new Error('Invalid session response');
            }
            req.voterId = voterId;
        } catch {
            req.authUnavailable = true;
        }
    }
    next();
}

export function requireSession(req, res, next) {
    if (!accountAuthEnabled || req.authUnavailable) {
        return sendError(res, 503, 'auth_unavailable', 'Вход сейчас недоступен.');
    }
    if (!req.voterId) return sendError(res, 401, 'login_required', 'Войдите, чтобы проголосовать.');
    return next();
}

export async function forwardAuth(req, res) {
    if (!accountAuthEnabled) return res.status(503).send('Вход сейчас недоступен.');
    try {
        const url = new URL(req.path, serviceUrl);
        const query = req.originalUrl.indexOf('?');
        if (query !== -1) url.search = req.originalUrl.slice(query);
        const headers = new Headers();
        for (const name of ['cookie', 'origin']) {
            const value = req.get(name);
            if (value) headers.set(name, value);
        }
        const body = req.body === undefined ? undefined : JSON.stringify(req.body);
        if (body !== undefined) headers.set('Content-Type', 'application/json');
        const response = await fetch(url, {
            method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(13_000),
        });
        for (const cookie of response.headers.getSetCookie()) res.append('Set-Cookie', cookie);
        const location = response.headers.get('location');
        if (location) res.set('Location', location);
        res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
        const type = response.headers.get('content-type')?.startsWith('application/json') ? 'application/json' : 'text/plain';
        res.status(response.status).type(type).send(await response.text());
    } catch {
        res.set('Cache-Control', 'no-store').status(503).send('Вход сейчас недоступен.');
    }
}
