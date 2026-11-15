import pool from '../database/db.js';
import { sendError } from '../middleware/errorHandler.js';
import { parseId } from './parseId.js';
import { authState } from '../middleware/auth.js';

export async function getNominations(req, res) {
    const includeNominees = req.query.include === 'nominees';
    const { rows } = await pool.query(`
        SELECT n.id, n.title, n.description, n.status, n.emoji, n.suggestions_preview,
            count(m.id)::int AS nominee_count, v.nominee_id AS voted_nominee_id,
            CASE WHEN $2::boolean THEN COALESCE(
                json_agg(json_build_object(
                    'id', m.id, 'name', m.name, 'description', m.description, 'image_url', m.image_url
                ) ORDER BY m.sort_order, m.id) FILTER (WHERE m.id IS NOT NULL), '[]'::json
            ) END AS nominees
        FROM nominations n
        LEFT JOIN nominees m ON m.nomination_id = n.id
        LEFT JOIN votes v ON v.nomination_id = n.id AND v.user_id = $1
        WHERE NOT n.archived
        GROUP BY n.id, v.nominee_id
        ORDER BY n.sort_order, n.id
    `, [req.voterId, includeNominees]);

    if (includeNominees) return res.json({ data: rows, auth: authState(req) });
    const data = rows.map(({ nominees, voted_nominee_id, ...summary }) => summary);
    return res.json({ data });
}

export async function getNomination(req, res) {
    const id = parseId(req.params.id);
    if (id === null) return sendError(res, 400, 'invalid_id', 'Укажите корректный идентификатор.');

    const { rows: [nomination] } = await pool.query(`
        SELECT n.id, n.title, n.description, n.status, n.emoji, n.suggestions_preview,
            v.nominee_id AS voted_nominee_id
        FROM nominations n
        LEFT JOIN votes v ON v.nomination_id = n.id AND v.user_id = $2
        WHERE n.id = $1 AND NOT n.archived
    `, [id, req.voterId]);
    if (!nomination) return sendError(res, 404, 'nomination_not_found', 'Номинация не найдена.');

    return res.json({ data: nomination });
}

export async function getResults(req, res) {
    const id = parseId(req.params.id);
    if (id === null) return sendError(res, 400, 'invalid_id', 'Укажите корректный идентификатор.');

    const { rows } = await pool.query(`
        SELECT n.status, m.id, m.name, count(v.id)::int AS vote_count
        FROM nominations n
        LEFT JOIN nominees m ON m.nomination_id = n.id AND n.status = 'closed'
        LEFT JOIN votes v ON v.nomination_id = n.id AND v.nominee_id = m.id
        WHERE n.id = $1 AND NOT n.archived
        GROUP BY n.status, m.id
        ORDER BY vote_count DESC, m.sort_order, m.id
    `, [id]);
    if (!rows.length) return sendError(res, 404, 'nomination_not_found', 'Номинация не найдена.');
    if (rows[0].status !== 'closed') {
        return sendError(res, 409, 'results_hidden', 'Результаты появятся после завершения голосования.');
    }

    const data = rows.filter((row) => row.id !== null)
        .map(({ id, name, vote_count }) => ({ id, name, vote_count }));
    return res.json({ data });
}
