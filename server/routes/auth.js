import { json, Router } from 'express';
import { forwardAuth } from '../middleware/auth.js';
import { sendError } from '../middleware/errorHandler.js';
import { apiCors, checkOrigin, limitAuth, limitEmailCode, limitSignIn, limitSignInAccount } from '../middleware/security.js';

const router = Router();

router.use('/auth', (_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
}, checkOrigin, apiCors);

router.get('/auth/login', limitAuth, forwardAuth);
router.post('/auth/logout', forwardAuth);

function requireJson(req, res, next) {
    if (!req.is('application/json')) {
        return sendError(res, 415, 'unsupported_payload', 'Ожидается запрос в формате JSON.');
    }
    next();
}

const credentials = [requireJson, json({ limit: '8kb' })];
router.post('/auth/email/request', limitEmailCode, ...credentials, forwardAuth);
router.post('/auth/email/verify', limitSignIn, ...credentials, forwardAuth);
router.post('/auth/sign-in', limitSignIn, ...credentials, limitSignInAccount, forwardAuth);
router.use(['/auth', '/internal'], (_req, res) => res.sendStatus(404));

export default router;
