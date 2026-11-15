import { Router } from 'express';
import { postVote } from '../controllers/votes.js';
import { demoVoting, readSession, requireSession } from '../middleware/auth.js';
import { readVoter } from '../middleware/voter.js';
import { anonymousVoting, readAnonymousVoter, requireAnonymousVoter, getVoterChallenge, verifyVoter } from '../middleware/anonymousVoter.js';
import { limitVoteIp, limitVoter, limitVoterChallenge, limitVoterIssuance } from '../middleware/security.js';

const router = Router();
const identify = anonymousVoting ? [readAnonymousVoter, requireAnonymousVoter]
    : demoVoting ? [readVoter] : [readSession, requireSession];

if (anonymousVoting) {
    router.get('/voter/challenge', limitVoterChallenge, getVoterChallenge);
    router.post('/voter/verify', readAnonymousVoter, limitVoterIssuance, verifyVoter);
}

router.post('/votes', limitVoteIp, ...identify, limitVoter, postVote);

export default router;
