import { Router } from 'express';
import { listInvitations, createInvitation, revokeInvitation, listInvitationUses, reissueInvitation } from './invitations.js';
import { requireRole } from './sessions.js';

const router = Router();
router.use(requireRole('MANAGER', 'SUPERADMIN'));
router.get('/', listInvitations);
router.post('/', createInvitation);
router.post('/users/:userId/reissue', requireRole('SUPERADMIN'), reissueInvitation);
router.post('/:id/revoke', revokeInvitation);
router.get('/:id/uses', listInvitationUses);

export default router;
