import { Router } from 'express';
import { getMyVotes, postVote } from './ballots.js';
import { readSession, requireSession } from '../auth/sessions.js';
import { limitVoteIp, limitVoter } from '../../middleware/security.js';

const router = Router();
router.get('/me', readSession, requireSession, getMyVotes);
router.post('/', limitVoteIp, readSession, requireSession, limitVoter, postVote);

export default router;
