import pool from '../../database/db.js';
import { sendError } from '../../middleware/errorHandler.js';

export async function createJuryReview(req, res) {
    const nominationId = req.body?.nomination_id;
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!Number.isSafeInteger(nominationId) || nominationId < 1
        || !content || content.includes('\0') || [...content].length > 256) {
        return sendError(res, 400, 'invalid_review', 'Отзыв должен содержать от 1 до 256 символов и относиться к существующей номинации.');
    }

    const { rows: [review] } = await pool.query(`
        INSERT INTO jury_reviews (nomination_id, jury_id, content)
        SELECT id, $2, $3 FROM nominations WHERE id = $1
        RETURNING id, nomination_id, content, created_at
    `, [nominationId, req.user.id, content]);
    if (!review) return sendError(res, 404, 'nomination_not_found', 'Номинация не найдена.');
    return res.status(201).json({ data: review });
}
