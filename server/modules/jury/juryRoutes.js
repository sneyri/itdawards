import { Router } from 'express';

import { createJuryReview } from './juryControllers.js';
import { readSession, requireRole } from '../auth/sessions.js';

const router = Router();
router.post('/reviews', readSession, requireRole('JURY'), createJuryReview);

export default router