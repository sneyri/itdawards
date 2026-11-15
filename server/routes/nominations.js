import { Router } from 'express';
import { getNomination, getNominations, getResults } from '../controllers/nominations.js';
import { demoVoting, readSession } from '../middleware/auth.js';
import { issueVoter, readVoter } from '../middleware/voter.js';
import { anonymousVoting, readAnonymousVoter } from '../middleware/anonymousVoter.js';

const router = Router();
const identify = anonymousVoting ? [readAnonymousVoter] : demoVoting ? [readVoter, issueVoter] : [readSession];

router.get('/nominations', ...identify, getNominations);
router.get('/nominations/:id', ...identify, getNomination);
router.get('/nominations/:id/results', getResults);

export default router;
