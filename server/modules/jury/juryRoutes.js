import { Router } from "express";

import { createJuryReview, test } from "./juryControllers.js";
import { readSession, requireRole } from '../auth/sessions.js';

const router = Router();
router.get('/test', test);
router.post('/reviews', readSession, requireRole('JURY'), createJuryReview);
router.post('/upload', readSession, requireRole('JURY'), createJuryReview);

export default router