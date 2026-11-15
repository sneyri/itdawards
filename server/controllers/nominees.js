import pool from '../database/db.js';
import { sendError } from '../middleware/errorHandler.js';
import { parseId } from './parseId.js';

export async function getNominees(req, res) {
    const id = parseId(req.params.id);
    if (id === null) return sendError(res, 400, 'invalid_id', 'Укажите корректный идентификатор.');

    const { rows } = await pool.query(`
        SELECT m.id, m.name, m.description, m.image_url
        FROM nominations n LEFT JOIN nominees m ON m.nomination_id = n.id
        WHERE n.id = $1 AND NOT n.archived
        ORDER BY m.sort_order, m.id
    `, [id]);
    if (!rows.length) return sendError(res, 404, 'nomination_not_found', 'Номинация не найдена.');

    return res.json({ data: rows.filter((row) => row.id !== null) });
}
