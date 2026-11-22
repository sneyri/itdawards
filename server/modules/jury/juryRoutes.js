import { Router } from 'express';

import { createJuryReview, getOwnJuryVote, saveJuryVote } from './juryControllers.js';
import { readSession, requireRole } from '../auth/sessions.js';

const router = Router();
router.post('/reviews', readSession, requireRole('JURY'), createJuryReview);
router.get('/votes/:nominationId', readSession, requireRole('JURY'), getOwnJuryVote);
router.post('/votes', readSession, requireRole('JURY'), saveJuryVote);

export default router