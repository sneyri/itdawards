import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { createChallenge, verifySolution } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { sendError } from './errorHandler.js';

export const anonymousVoting = process.env.VOTING_MODE === 'anonymous';

const secret = process.env.ANONYMOUS_VOTER_SECRET;
if (anonymousVoting && !/^[0-9a-f]{64}$/i.test(secret ?? '')) {
    throw new Error('Set ANONYMOUS_VOTER_SECRET to a random 32-byte hex value.');
}

const cookieName = 'itd_awards_anonymous';
const cookiePattern = /(?:^|;\s*)itd_awards_anonymous=([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([0-9a-f]{64})(?=;|$)/;
const algorithm = 'PBKDF2/SHA-256';
const cost = 300;

function mac(label, value) {
    return createHmac('sha256', secret).update(label + ':' + value).digest('hex');
}

export function readAnonymousVoter(req, _res, next) {
    req.voterId = null;
    const cookie = req.get('cookie')?.match(cookiePattern);
    if (cookie) {
        const [, id, signature] = cookie;
        if (timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(mac('voter-cookie', id), 'hex'))) {
            req.voterId = id;
        }
    }
    next();
}

export function requireAnonymousVoter(req, res, next) {
    if (!req.voterId) {
        return sendError(res, 403, 'voter_verification_required', 'Пройдите проверку браузера перед голосованием.');
    }
    return next();
}

export async function getVoterChallenge(_req, res) {
    const challenge = await createChallenge({
        algorithm, cost, deriveKey, counter: randomInt(512, 2048),
        expiresAt: new Date(Date.now() + 2 * 60_000),
        hmacSignatureSecret: mac('challenge-key', ''),
    });
    return res.json({ data: challenge });
}

export async function verifyVoter(req, res) {
    if (req.voterId) return res.json({ data: { verified: true } });

    const { challenge, solution } = req.body ?? {};
    const params = challenge?.parameters;
    if (params?.algorithm !== algorithm || params.cost !== cost || params.keyLength !== 32
        || !Number.isInteger(params.expiresAt) || params.expiresAt <= 0
        || typeof params.nonce !== 'string' || !/^[0-9a-f]{32}$/.test(params.nonce)
        || typeof params.salt !== 'string' || !/^[0-9a-f]{32}$/.test(params.salt)
        || typeof challenge.signature !== 'string' || !/^[0-9a-f]{64}$/.test(challenge.signature)) {
        return sendError(res, 422, 'invalid_voter_proof', 'Проверка браузера не пройдена. Попробуйте ещё раз.');
    }

    const result = await verifySolution({
        challenge, solution, deriveKey, hmacSignatureSecret: mac('challenge-key', ''),
    });
    if (!result.verified) {
        return sendError(res, 422, 'invalid_voter_proof', 'Проверка браузера не пройдена. Попробуйте ещё раз.');
    }

    // A replay has the same signed nonce and always produces the same voter ID.
    const id = Buffer.from(mac('voter-id', params.nonce).slice(0, 32), 'hex');
    id[6] = (id[6] & 0x0f) | 0x40;
    id[8] = (id[8] & 0x3f) | 0x80;
    const voterId = id.toString('hex').replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
    res.cookie(cookieName, `${voterId}.${mac('voter-cookie', voterId)}`, {
        httpOnly: true,
        sameSite: 'strict',
        secure: req.secure || process.env.PUBLIC_ORIGIN?.startsWith('https:'),
        path: '/api',
        maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    return res.json({ data: { verified: true } });
}
