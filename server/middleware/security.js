import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { sendError } from './errorHandler.js';
import { publicOrigin } from '../config.js';
import pool from '../database/db.js';

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
            imgSrc: ["'self'", 'https:'],
            mediaSrc: ["'self'", 'https:'],
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
    if (!origin || !allowed(req, origin)) {
        return sendError(res, 403, 'origin_forbidden', 'Запрос с этого сайта запрещён.');
    }
    next();
}

export const apiCors = cors((req, callback) => {
    const origin = req.get('origin');
    callback(null, {
        origin: origin && allowed(req, origin) ? origin : false,
        credentials: true,
        methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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
export const limitBot = limiter(60_000, 300);
export const limitLogin = limiter(10 * 60_000, 20, {
    skipSuccessfulRequests: true,
    async handler(req, res) {
        if (req.rateLimit.used === req.rateLimit.limit + 1) {
            try {
                await pool.query(`
                    INSERT INTO audit_logs (action, target_type, target_id)
                    VALUES ('auth.rate_limited', 'security', 'telegram_login')
                `);
            } catch (error) {
                console.error('Ошибка записи аудита:', error.code ?? error.name);
            }
        }
        return sendError(res, 429, 'rate_limited', 'Слишком много попыток входа. Попробуйте позже.');
    },
});
export const limitVoteIp = limiter(60_000, 90);
export const limitVoter = limiter(60_000, 30, { keyGenerator: (req) => req.user.id });

export function preventCaching(_req, res, next) {
    res.set('Cache-Control', 'no-store');
    next();
}
