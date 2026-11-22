import pool from '../../database/db.js';
import { sendError } from '../../middleware/errorHandler.js';
import { parseId } from '../../middleware/parseId.js';

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

export async function getOwnJuryVote(req, res) {
    const nominationId = parseId(req.params.nominationId);
    if (nominationId === null) return sendError(res, 400, 'invalid_id', 'Некорректный идентификатор номинации.');

    const { rows: [vote] } = await pool.query(`
        SELECT n.id AS nomination_id, v.nominee_id, nominee.name AS nominee_name,
            v.justification, v.updated_at
        FROM nominations n
        LEFT JOIN jury_votes v ON v.nomination_id = n.id AND v.jury_id = $2
        LEFT JOIN nominees nominee ON nominee.nomination_id = v.nomination_id AND nominee.id = v.nominee_id
        WHERE n.id = $1
    `, [nominationId, req.user.id]);
    if (!vote) return sendError(res, 404, 'nomination_not_found', 'Номинация не найдена.');
    if (vote.nominee_id === null) return res.json({ data: null });
    return res.json({ data: vote });
}

export async function saveJuryVote(req, res) {
    const nominationId = parseId(req.body?.nomination_id);
    const nomineeId = parseId(req.body?.nominee_id);
    const justification = typeof req.body?.justification === 'string' ? req.body.justification.trim() : '';
    if (nominationId === null || nomineeId === null || !justification
        || justification.includes('\0') || [...justification].length > 256) {
        return sendError(res, 400, 'invalid_jury_vote',
            'Выберите номинанта и укажите обоснование длиной от 1 до 256 символов.');
    }

    const { rows: [vote] } = await pool.query(`
        INSERT INTO jury_votes (nomination_id, nominee_id, jury_id, justification)
        SELECT nominee.nomination_id, nominee.id, $3, $4
        FROM nominees nominee
        JOIN nominations nomination ON nomination.id = nominee.nomination_id
        WHERE nominee.nomination_id = $1 AND nominee.id = $2
            AND NOT nomination.archived AND NOT nominee.archived
        ON CONFLICT (jury_id, nomination_id) DO UPDATE
            SET nominee_id = EXCLUDED.nominee_id,
                justification = EXCLUDED.justification,
                updated_at = clock_timestamp()
        RETURNING nomination_id, nominee_id, justification, updated_at
    `, [nominationId, nomineeId, req.user.id, justification]);
    if (!vote) {
        return sendError(res, 404, 'nominee_not_found', 'Номинант не найден в выбранной номинации.');
    }
    return res.json({ data: vote });
}

export async function getAdminJuryVotes(req, res) {
    let nominationId = null;
    if (req.query.nomination_id !== undefined) {
        nominationId = parseId(req.query.nomination_id);
        if (nominationId === null || Array.isArray(req.query.nomination_id)) {
            return sendError(res, 400, 'invalid_id', 'Некорректный идентификатор номинации.');
        }
    }

    const [nominations, counts, votes, legacyReviews] = await Promise.all([
        pool.query(`
            SELECT id, title FROM nominations
            WHERE ($1::integer IS NULL OR id = $1)
            ORDER BY sort_order, id
        `, [nominationId]),
        pool.query(`
            SELECT n.id AS nomination_id, n.title AS nomination_title,
                nominee.id AS nominee_id, nominee.name AS nominee_name,
                count(v.nomination_id)::int AS vote_count
            FROM nominations n
            JOIN nominees nominee ON nominee.nomination_id = n.id
            LEFT JOIN jury_votes v
                ON v.nomination_id = n.id AND v.nominee_id = nominee.id
            WHERE ($1::integer IS NULL OR n.id = $1)
            GROUP BY n.id, nominee.id
            ORDER BY n.sort_order, n.id, nominee.sort_order, nominee.id
        `, [nominationId]),
        pool.query(`
            SELECT n.id AS nomination_id, n.title AS nomination_title,
                nominee.id AS nominee_id, nominee.name AS nominee_name,
                v.justification, v.updated_at
            FROM jury_votes v
            JOIN nominations n ON n.id = v.nomination_id
            JOIN nominees nominee ON nominee.nomination_id = v.nomination_id AND nominee.id = v.nominee_id
            WHERE ($1::integer IS NULL OR n.id = $1)
            ORDER BY n.sort_order, n.id, v.updated_at DESC
        `, [nominationId]),
        pool.query(`
            SELECT n.id AS nomination_id, n.title AS nomination_title,
                NULL::integer AS nominee_id, NULL::text AS nominee_name,
                review.content AS justification, review.created_at
            FROM jury_reviews review
            JOIN nominations n ON n.id = review.nomination_id
            WHERE ($1::integer IS NULL OR n.id = $1)
            ORDER BY n.sort_order, n.id, review.created_at DESC
        `, [nominationId]),
    ]);

    return res.json({ data: {
        nominations: nominations.rows,
        counts: counts.rows,
        votes: votes.rows,
        legacy_reviews: legacyReviews.rows,
    } });
}
