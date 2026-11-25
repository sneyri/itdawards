import { publicOrigin } from '../../config.js';
import pool from '../../database/db.js';
import { activeVoting } from '../voting/tallies.js';
import { sendError } from '../../middleware/errorHandler.js';
import { parseId } from '../../middleware/parseId.js';
import { authState } from '../auth/sessions.js';
import { storageRoot, thumbnailMedia } from '../media/mediaStorage.js';

function notFound(res) {
    return sendError(res, 404, 'nomination_not_found', 'Номинация не найдена.');
}

function invalidId(res) {
    return sendError(res, 400, 'invalid_id', 'Укажите корректный идентификатор.');
}

async function readCatalog(userId, includeNominees, nominationId = null) {
    const { rows } = await pool.query(`
        WITH current_settings AS (
            SELECT s.allow_vote_changes, s.opens_at, s.closes_at, s.results_published, (${activeVoting}) AS open
            FROM settings s WHERE s.id = 1
        )
        SELECT n.id, n.title, n.description, n.status, n.emoji, n.image_url, n.suggestions_preview,
            $5::text || nomination_image.thumbnail_id AS thumbnail_url,
            (n.status = 'open' AND s.open) AS can_vote, s.results_published AS results_available,
            COALESCE(entry.nominee_count, 0) AS nominee_count,
            v.nominee_id AS voted_nominee_id, chosen.name AS voted_nominee_name,
            CASE WHEN $2::boolean THEN COALESCE(entry.nominees, '[]'::json) END AS nominees,
            json_build_object(
                'allowVoteChanges', s.allow_vote_changes, 'startsAt', s.opens_at, 'endsAt', s.closes_at,
                'resultsPublished', s.results_published, 'open', s.open
            ) AS voting
        FROM current_settings s
        LEFT JOIN nominations n ON NOT n.archived AND n.status <> 'draft' AND ($3::int IS NULL OR n.id = $3)
        LEFT JOIN votes v ON v.nomination_id = n.id AND v.user_id = $1 AND v.voter_role IS NOT NULL
        LEFT JOIN nominees chosen ON chosen.id = v.nominee_id
        LEFT JOIN catalog_images nomination_image ON $4::boolean
            AND nomination_image.id = substring(n.image_url from '^/api/media/([a-f0-9]{64})$')
        LEFT JOIN LATERAL (
            SELECT count(*)::int AS nominee_count, CASE WHEN $2::boolean THEN json_agg(json_build_object(
                'id', m.id, 'name', m.name, 'description', m.description, 'handle', m.handle, 'song', m.song,
                'image_url', m.image_url, 'thumbnail_url', $5::text || nominee_image.thumbnail_id,
                'image_alt', m.image_alt, 'audio_url', m.audio_url, 'link_url', m.link_url
            ) ORDER BY m.sort_order, m.id) END AS nominees
            FROM nominees m
            LEFT JOIN catalog_images nominee_image ON $2::boolean AND $4::boolean
                AND nominee_image.id = substring(m.image_url from '^/api/media/([a-f0-9]{64})$')
            WHERE m.nomination_id = n.id AND NOT m.archived
        ) entry ON true
        ORDER BY n.sort_order, n.id
    `, [userId, includeNominees, nominationId, Boolean(storageRoot), thumbnailMedia.prefix]);
    return {
        data: rows.filter((row) => row.id !== null).map(({ voting, ...row }) => row),
        voting: rows[0].voting,
    };
}

export async function getNominations(req, res) {
    const includeNominees = req.query.include === 'nominees';
    const { data, voting } = await readCatalog(req.user?.id ?? null, includeNominees);
    if (includeNominees) return res.json({ data, auth: authState(req), voting });
    return res.json({
        data: data.map(({ nominees, voted_nominee_id, voted_nominee_name, ...nomination }) => nomination),
        voting,
    });
}

export async function getNomination(req, res) {
    const id = parseId(req.params.id);
    if (id === null) return invalidId(res);
    const { data: [nomination], voting } = await readCatalog(req.user?.id ?? null, true, id);
    if (!nomination) return notFound(res);
    return res.json({ data: nomination, auth: authState(req), voting });
}

export async function getNominees(req, res) {
    const id = parseId(req.params.id);
    if (id === null) return invalidId(res);
    const { data: [nomination] } = await readCatalog(null, true, id);
    if (!nomination) return notFound(res);
    return res.json({ data: nomination.nominees });
}


export async function botCatalog(_req, res) {
    const [{ rows: nominations }, { rows: [settings] }] = await Promise.all([
        pool.query("SELECT id, title, status FROM nominations WHERE NOT archived AND status <> 'draft' ORDER BY sort_order, id"),
        pool.query('SELECT ' + activeVoting + ' AS open FROM settings s WHERE s.id = 1'),
    ]);
    return res.json({ data: { nominations, votingOpen: settings?.open === true, siteOrigin: publicOrigin ?? null } });
}
