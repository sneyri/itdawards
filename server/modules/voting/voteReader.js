import pool from '../../database/db.js';

const userVotesQuery = `
    SELECT n.sort_order AS nomination_sort_order,
        v.nomination_id, v.nominee_id, n.title AS nomination_title, nominee.name AS nominee_name,
        'votes'::text AS source, v.voter_role, v.weight, NULL::text AS justification,
        v.created_at, v.updated_at
    FROM votes v
    JOIN nominations n ON n.id = v.nomination_id
    JOIN nominees nominee ON nominee.id = v.nominee_id
    WHERE v.voter_role IS NOT NULL
        AND ($1::uuid IS NULL OR v.user_id = $1)
        AND ($2::integer IS NULL OR v.nomination_id = $2)
`;

const juryVotesQuery = `
    SELECT n.sort_order AS nomination_sort_order,
        v.nomination_id, v.nominee_id, n.title AS nomination_title, nominee.name AS nominee_name,
        'jury_votes'::text AS source, 'JURY'::text AS voter_role, NULL::integer AS weight,
        v.justification, v.created_at, v.updated_at
    FROM jury_votes v
    JOIN nominations n ON n.id = v.nomination_id
    JOIN nominees nominee ON nominee.nomination_id = v.nomination_id AND nominee.id = v.nominee_id
    WHERE ($1::uuid IS NULL OR v.jury_id = $1)
        AND ($2::integer IS NULL OR v.nomination_id = $2)
`;

function orderVotes(rows) {
    return rows
        .sort((first, second) => first.nomination_sort_order - second.nomination_sort_order
            || first.nomination_id - second.nomination_id
            || (first.source === second.source ? 0 : first.source === 'votes' ? -1 : 1))
        .map(({ nomination_sort_order, ...vote }) => vote);
}

export async function readOwnVotes(userId, role, nominationId = null) {
    if (!userId) return [];

    const reads = [
        pool.query(userVotesQuery, [userId, nominationId]),
        role === 'JURY' ? pool.query(juryVotesQuery, [userId, nominationId]) : Promise.resolve({ rows: [] }),
    ];
    const [userVotes, juryVotes] = await Promise.all(reads);
    return orderVotes([...userVotes.rows, ...juryVotes.rows]);
}

// Restrict this unscoped reader to trusted server-side operations with explicit authorization.
export async function readCombinedVotes(nominationId = null) {
    const [userVotes, juryVotes] = await Promise.all([
        pool.query(userVotesQuery, [null, nominationId]),
        pool.query(juryVotesQuery, [null, nominationId]),
    ]);
    return orderVotes([...userVotes.rows, ...juryVotes.rows]);
}
