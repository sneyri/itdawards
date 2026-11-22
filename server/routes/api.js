import { Router } from 'express';
import adminRoutes from '../modules/admin/adminRoutes.js';
import nexusRoutes from '../modules/admin/nexusRoutes.js';
import authRoutes from '../modules/auth/authRoutes.js';
import invitationRoutes from '../modules/auth/invitationRoutes.js';
import awardsRoutes from '../modules/awards/awardsRoutes.js';
import mediaRoutes from '../modules/awards/mediaRoutes.js';
import uploadRoutes from '../modules/awards/uploadRoutes.js';
import votingRoutes from '../modules/voting/votingRoutes.js';
import { systemStatus } from '../modules/monitoring/system.js';
import { readSession, requireRole } from '../modules/auth/sessions.js';
import botRoutes from './botRoutes.js';
import { routeNotFound } from '../middleware/errorHandler.js';
import { parseApiJson, parseCatalogJson } from '../middleware/requestBody.js';
import { apiCors, checkOrigin, limitApi, preventCaching } from '../middleware/security.js';

const router = Router();
router.use(preventCaching);
router.use('/bot', botRoutes);

router.use(checkOrigin, apiCors, limitApi);
router.post('/admin/catalog/import', readSession, requireRole('MANAGER', 'SUPERADMIN'), parseCatalogJson);
router.use(parseApiJson);
router.use('/auth', authRoutes);
router.use('/nominations', awardsRoutes);
router.use('/votes', votingRoutes);
router.use('/media', mediaRoutes);
router.use('/admin/uploads', readSession, uploadRoutes);
router.get('/admin/system', readSession, requireRole('MANAGER', 'SUPERADMIN'), systemStatus);
router.use('/admin/invitations', readSession, invitationRoutes);
router.use('/admin/nexus', readSession, nexusRoutes);
router.use('/admin', readSession, adminRoutes);
router.use(routeNotFound);

export default router;
