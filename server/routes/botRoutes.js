import { Router } from 'express';
import { getLinkStatus, issueCode, requireBot } from '../modules/auth/telegramAuth.js';
import { botCatalog } from '../modules/awards/catalog.js';
import { botHeartbeat } from '../modules/monitoring/system.js';
import { parseApiJson } from '../middleware/requestBody.js';
import { routeNotFound } from '../middleware/errorHandler.js';
import { limitBot } from '../middleware/security.js';

const router = Router();
router.use(requireBot, limitBot, parseApiJson);
router.post('/code', issueCode);
router.post('/status', getLinkStatus);
router.post('/catalog', botCatalog);
router.post('/heartbeat', botHeartbeat);
router.use(routeNotFound);

export default router;
