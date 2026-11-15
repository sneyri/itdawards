import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { sendError } from './errorHandler.js';

const publicOrigin = process.env.PUBLIC_ORIGIN;
const allowedOrigins = [publicOrigin, ...((process.env.CORS_ORIGINS ?? '').split(','))]
    .map((origin) => origin?.trim()).filter(Boolean);
for (const origin of allowedOrigins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) {
        throw new Error('PUBLIC_ORIGIN and CORS_ORIGINS must contain exact HTTP(S) origins.');
    }
}

export const securityHeaders = helmet({
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: publicOrigin?.startsWith('https:') ? undefined : false,
    contentSecurityPolicy: {
        directives: {
            upgradeInsecureRequests: publicOrigin?.startsWith('https:') ? [] : null,
        },
    },
});

function allowed(req, origin) {
    return allowedOrigins.includes(origin)
        || (!publicOrigin && origin === `${req.protocol}://${req.get('host')}`);
}

export function checkOrigin(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD') return next();

    const origin = req.get('origin');
    if (origin ? !allowed(req, origin) : req.get('sec-fetch-site') === 'cross-site') {
        return sendError(res, 403, 'origin_forbidden', 'Запрос с этого сайта запрещён.');
    }
    next();
}

export const apiCors = cors((req, callback) => {
    const origin = req.get('origin');
    callback(null, {
        origin: origin && allowed(req, origin) ? origin : false,
        credentials: true,
        methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
        exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'],
    });
});

function limiter(windowMs, limit, options = {}) {
    return rateLimit({
        windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false,
        handler: (_req, res) => sendError(res, 429, 'rate_limited', 'Слишком много запросов. Попробуйте позже.'),
        ...options,
    });
}

export const limitApi = limiter(60_000, 240);
export const limitAuth = limiter(15 * 60_000, 30);
export const limitEmailCode = limiter(10 * 60_000, 12);
export const limitSignIn = limiter(15 * 60_000, 10, { skipSuccessfulRequests: true });
export const limitSignInAccount = limiter(15 * 60_000, 30, {
    skip: (req) => typeof req.body?.username !== 'string' || !req.body.username.trim() || req.body.username.length > 64,
    keyGenerator: (req) => req.body.username.trim().replace(/^@/, '').toLowerCase(),
    skipSuccessfulRequests: true,
});
export const limitVoteIp = limiter(60_000, 90);
export const limitVoterChallenge = limiter(10 * 60_000, 24);
export const limitVoterIssuance = limiter(10 * 60_000, 12, { skip: (req) => Boolean(req.voterId) });
export const limitVoter = limiter(60_000, 30, {
    skip: (req) => !req.voterId,
    keyGenerator: (req) => req.voterId,
});
