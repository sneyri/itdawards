import { randomUUID } from 'node:crypto';

const cookieName = 'itd_awards_voter';
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readVoter(req, res, next) {
    const prefix = `${cookieName}=`;
    const cookie = req.headers.cookie?.split(';').map((part) => part.trim())
        .find((part) => part.startsWith(prefix));
    const id = cookie?.slice(prefix.length);
    req.voterId = uuidV4.test(id ?? '') ? id : null;
    next();
}

export function issueVoter(req, res, next) {
    if (!req.voterId) {
        req.voterId = randomUUID();
        res.cookie(cookieName, req.voterId, {
            httpOnly: true,
            sameSite: 'strict',
            path: '/api',
            maxAge: 365 * 24 * 60 * 60 * 1000,
        });
    }
    next();
}
