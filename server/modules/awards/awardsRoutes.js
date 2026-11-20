import { Router } from 'express';
import { getNomination, getNominations, getNominees } from './catalog.js';
import { getResults } from '../voting/results.js';
import { readSession } from '../auth/sessions.js';

const router = Router();
router.get('/', readSession, getNominations);
router.get('/:id', readSession, getNomination);
router.get('/:id/nominees', getNominees);
router.get('/:id/results', getResults);

export default router;
