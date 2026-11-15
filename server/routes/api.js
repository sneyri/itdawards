import { json, Router } from 'express';
import { sendError } from '../middleware/errorHandler.js';
import nominations from './nominations.js';
import nominees from './nominees.js';
import votes from './votes.js';
import { apiCors, checkOrigin, limitApi } from '../middleware/security.js';

const router = Router();

router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
router.use(checkOrigin, apiCors, limitApi, json({ limit: '8kb' }));
router.use(nominations, nominees, votes);
router.use((_req, res) => sendError(res, 404, 'route_not_found', 'Маршрут не найден.'));

export default router;
