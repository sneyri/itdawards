import pool, { transaction } from '../../database/db.js';
import { activeVoting } from './tallies.js';
import { sendError } from '../../middleware/errorHandler.js';
import { parseId } from '../../middleware/parseId.js';
import { readOwnVotes } from './voteReader.js';

const errors = {
    login_required: [401, 'Войдите в аккаунт.'],
    nomination_not_found: [404, 'Номинация не найдена.'],
    nominee_not_found: [404, 'Номинант не найден.'],
    nominee_mismatch: [422, 'Номинант не относится к этой номинации.'],
    voting_unavailable: [409, 'Голосование в этой номинации сейчас недоступно.'],
    already_voted: [409, 'Вы уже проголосовали в этой номинации.'],
};

export async function getMyVotes(req, res) {
    const votes = await readOwnVotes(req.user.id, req.user.role);
    return res.json({ data: votes });
}

export async function postVote(req, res) {
    const nominationId = parseId(req.body?.nomination_id);
    const nomineeId = parseId(req.body?.nominee_id);
    if (nominationId === null || nomineeId === null) {
        return sendError(res, 400, 'invalid_id', 'Укажите корректный идентификатор.');
    }
    const outcome = await transaction((client) => saveVote(client, nominationId, nomineeId, req.user.id));
    if (outcome !== 'saved') {
        if (outcome === 'already_voted') res.locals.duplicateVote = true;
        const [status, message] = errors[outcome];
        return sendError(res, status, outcome, message);
    }
    return res.status(201).json({ data: { nomination_id: nominationId, nominee_id: nomineeId } });
}

export async function saveVote(client, nominationId, nomineeId, userId) {
    const { rows: [user] } = await client.query('SELECT role, blocked FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!user || user.blocked) return 'login_required';
    // Lock settings before the catalog rows so voting and admin changes use the same order.
    await client.query('SELECT id FROM settings WHERE id = 1 FOR SHARE');
    const { rows: [nomination] } = await client.query(
        "SELECT status FROM nominations WHERE id = $1 AND NOT archived AND status <> 'draft' FOR SHARE", [nominationId],
    );
    if (!nomination) return 'nomination_not_found';
    if (nomination.status !== 'open') return 'voting_unavailable';
    const { rows: [nominee] } = await client.query(
        'SELECT nomination_id FROM nominees WHERE id = $1 AND NOT archived FOR SHARE', [nomineeId],
    );
    if (!nominee) return 'nominee_not_found';
    if (nominee.nomination_id !== nominationId) return 'nominee_mismatch';
    // Use the current time after acquiring all locks, in case an earlier lock had to wait.
    const { rows: [settings] } = await client.query(
        `SELECT (${activeVoting}) AS open, jury_weight, allow_vote_changes FROM settings s WHERE id = 1`,
    );
    if (!settings.open) return 'voting_unavailable';

    // A vote change keeps the role and weight recorded on the first vote.
    const weight = user.role === 'JURY' ? settings.jury_weight : 1;
    const result = await client.query(`
        INSERT INTO votes (user_id, nomination_id, nominee_id, voter_role, weight)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, nomination_id) DO UPDATE SET
            nominee_id = EXCLUDED.nominee_id,
            updated_at = CASE WHEN votes.nominee_id <> EXCLUDED.nominee_id THEN now() ELSE votes.updated_at END,
            voter_role = votes.voter_role,
            weight = votes.weight
        WHERE $6::boolean
    `, [userId, nominationId, nomineeId, user.role, weight, settings.allow_vote_changes]);
    return result.rowCount ? 'saved' : 'already_voted';
}
