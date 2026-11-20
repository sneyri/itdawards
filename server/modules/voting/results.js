import { sendError } from '../../middleware/errorHandler.js';
import { parseId } from '../../middleware/parseId.js';
import pool from '../../database/db.js';
import { activeVoting, voteTotals } from './tallies.js';
import { sendCsv } from '../admin/exportCsv.js';

async function readResults() {
    const { rows } = await pool.query(`
        SELECT n.id AS nomination_id, n.title, m.id, m.name, m.archived, ${voteTotals}
        FROM nominations n JOIN nominees m ON m.nomination_id = n.id
        LEFT JOIN votes v ON v.nomination_id = n.id AND v.nominee_id = m.id AND v.voter_role IS NOT NULL
        GROUP BY n.id, m.id ORDER BY n.sort_order, n.id, weighted_score DESC, m.sort_order, m.id
    `);
    return rows.map((row) => ({ ...row, weighted_score: Number(row.weighted_score) }));
}

export async function getAdminResults(_req, res) {
    res.json({ data: await readResults() });
}

export async function exportResultsCsv(_req, res) {
    const rows = await readResults();
    const columns = ['nomination_id', 'title', 'id', 'name', 'archived', 'vote_count', 'user_votes', 'jury_votes', 'weighted_score'];
    sendCsv(res, 'itd-awards-results.csv', columns, rows);
}

export async function exportResultsJson(_req, res) {
    res.attachment('itd-awards-results.json').json({ data: await readResults() });
}

export async function getResults(req, res) {
    const id = parseId(req.params.id);
    if (id === null) return sendError(res, 400, 'invalid_id', 'Некорректный идентификатор.');
    const { rows } = await pool.query(`
        SELECT s.results_published, m.id, m.name, ${voteTotals}
        FROM nominations n
        CROSS JOIN settings s
        LEFT JOIN nominees m ON m.nomination_id = n.id AND NOT m.archived AND s.results_published
        LEFT JOIN votes v ON v.nomination_id = n.id AND v.nominee_id = m.id AND v.voter_role IS NOT NULL
        WHERE n.id = $1 AND NOT n.archived AND n.status <> 'draft' AND s.id = 1
        GROUP BY s.results_published, m.id
        ORDER BY weighted_score DESC, m.sort_order, m.id
    `, [id]);
    if (!rows.length) return sendError(res, 404, 'nomination_not_found', 'Номинация не найдена.');
    if (!rows[0].results_published) {
        return sendError(res, 409, 'results_hidden', 'Результаты пока не опубликованы.');
    }
    return res.json({
        data: rows.filter((row) => row.id !== null)
            .map(({ results_published, weighted_score, ...row }) => ({ ...row, weighted_score: Number(weighted_score) })),
    });
}
