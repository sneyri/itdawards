import pool from '../database/db.js';
import { sendError } from '../middleware/errorHandler.js';
import { parseId } from './parseId.js';

const errors = {
    nomination_not_found: [404, 'Номинация не найдена.'],
    nominee_not_found: [404, 'Номинант не найден.'],
    nominee_mismatch: [422, 'Номинант не относится к этой номинации.'],
    voting_unavailable: [409, 'Голосование в этой номинации сейчас недоступно.'],
    already_voted: [409, 'Вы уже проголосовали в этой номинации.'],
};

export async function postVote(req, res) {
    const nominationId = parseId(req.body?.nomination_id);
    const nomineeId = parseId(req.body?.nominee_id);
    if (nominationId === null || nomineeId === null) {
        return sendError(res, 400, 'invalid_id', 'Укажите корректный идентификатор.');
    }
    if (!req.voterId) {
        return sendError(res, 400, 'voter_required', 'Откройте страницу номинации и разрешите cookie для голосования.');
    }

    const client = await pool.connect();
    let outcome;
    let releaseError;
    try {
        await client.query('BEGIN');
        outcome = await insertVote(client, nominationId, nomineeId, req.voterId);
        await client.query('COMMIT');
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            releaseError = rollbackError;
        }
        throw error;
    } finally {
        client.release(releaseError);
    }

    if (outcome !== 'saved') {
        const [status, message] = errors[outcome];
        return sendError(res, status, outcome, message);
    }
    return res.status(201).json({ data: { nomination_id: nominationId, nominee_id: nomineeId } });
}

async function insertVote(client, nominationId, nomineeId, userId) {
    // Keep the nomination open until this transaction finishes.
    const { rows: [nomination] } = await client.query(
        'SELECT status FROM nominations WHERE id = $1 AND NOT archived FOR SHARE', [nominationId],
    );
    if (!nomination) return 'nomination_not_found';
    if (nomination.status !== 'open') return 'voting_unavailable';

    const { rows: [nominee] } = await client.query(
        'SELECT nomination_id FROM nominees WHERE id = $1 FOR KEY SHARE', [nomineeId],
    );
    if (!nominee) return 'nominee_not_found';
    if (nominee.nomination_id !== nominationId) return 'nominee_mismatch';

    const result = await client.query(`
        INSERT INTO votes (user_id, nomination_id, nominee_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, nomination_id) DO NOTHING
    `, [userId, nominationId, nomineeId]);
    return result.rowCount ? 'saved' : 'already_voted';
}
