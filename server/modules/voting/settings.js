import pool from '../../database/db.js';
import { AdminError, boolean, date, validateFields, integer, invalid } from '../admin/adminValidation.js';
import { recordAudit, runAdminChange, updateFields } from '../admin/adminChanges.js';

const settingsFields = { voting_open: boolean, opens_at: date, closes_at: date, allow_vote_changes: boolean,
    jury_weight: integer(1, 100), results_published: boolean };

export async function getSettings(_req, res) {
    const { rows: [settings] } = await pool.query(`
        SELECT voting_open, opens_at, closes_at, allow_vote_changes, jury_weight, results_published
        FROM settings WHERE id = 1
    `);
    res.json({ data: settings });
}

export async function updateSettings(req, res) {
    return runAdminChange(req, res, async (client, actor) => {
        const values = validateFields(req.body, settingsFields, { confirmation: true });
        const ownerOnly = ['allow_vote_changes', 'jury_weight', 'results_published'];
        if (actor.role === 'MANAGER' && ownerOnly.some((field) => Object.hasOwn(values, field))) {
            throw new AdminError(403, 'forbidden', 'Эти параметры доступны владельцу.');
        }
        const { rows: [before] } = await client.query('SELECT * FROM settings WHERE id = 1 FOR UPDATE');
        const next = { ...before, ...values };
        if (next.opens_at && next.closes_at && next.opens_at >= next.closes_at) {
            invalid('Окончание голосования должно быть позже начала.');
        }
        if ((!before.results_published && next.results_published && before.voting_open)
            || (before.results_published && next.voting_open) || (next.voting_open && next.results_published)) {
            throw new AdminError(409, 'voting_publication_conflict',
                'Закройте голосование перед публикацией. Снимите результаты с публикации перед открытием.');
        }
        const { row, details } = await updateFields(client, 'settings', 1, before, values);
        await recordAudit(client, req.user.id, 'settings.updated', 'settings', 1, details);
        const { voting_open, opens_at, closes_at, allow_vote_changes, jury_weight, results_published } = row;
        return { data: { voting_open, opens_at, closes_at, allow_vote_changes, jury_weight, results_published } };
    });
}
