import { Router } from 'express';
import { requireRole } from '../auth/sessions.js';
import { nexusTelemetry } from '../monitoring/system.js';
import { listTables, readTable } from './databaseExplorer.js';
import { accountSessions, listSessions, revokeSession, securitySummary } from '../auth/sessionAdmin.js';
import { createInvitationBatch } from '../auth/invitations.js';

const router = Router();
router.use(requireRole('MANAGER', 'SUPERADMIN'));
router.get('/telemetry', nexusTelemetry);
router.post('/invitations/bulk', createInvitationBatch);
router.use(requireRole('SUPERADMIN'));
router.get('/tables', listTables);
router.get('/tables/:id', readTable);
router.get('/security', securitySummary);
router.get('/sessions', listSessions);
router.get('/users/:id/sessions', accountSessions);
router.delete('/users/:userId/sessions/:sessionId', revokeSession);

export default router;
