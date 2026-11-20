import pool from '../../database/db.js';

export async function getDashboardCharts() {
    const [{ rows: trends }, { rows: nomination_votes }] = await Promise.all([
        pool.query(`
            WITH days AS (
                SELECT generate_series((now() AT TIME ZONE 'UTC')::date - 29,
                    (now() AT TIME ZONE 'UTC')::date, interval '1 day')::date AS day
            ), ballots AS (
                SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS votes,
                    count(DISTINCT user_id)::int AS active_users
                FROM votes WHERE voter_role IS NOT NULL AND created_at >= ((SELECT min(day) FROM days)::timestamp AT TIME ZONE 'UTC')
                GROUP BY 1
            ), accounts AS (
                SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS registrations
                FROM users WHERE last_login_at IS NOT NULL AND created_at >= ((SELECT min(day) FROM days)::timestamp AT TIME ZONE 'UTC')
                GROUP BY 1
            )
            SELECT to_char(days.day, 'YYYY-MM-DD') AS day, coalesce(ballots.votes, 0) AS votes,
                coalesce(ballots.active_users, 0) AS active_users,
                coalesce(accounts.registrations, 0) AS registrations
            FROM days LEFT JOIN ballots USING (day) LEFT JOIN accounts USING (day)
            ORDER BY days.day
        `),
        pool.query(`
            SELECT n.id, n.title, n.status, n.archived, count(v.id)::int AS vote_count
            FROM nominations n LEFT JOIN votes v ON v.nomination_id = n.id AND v.voter_role IS NOT NULL
            GROUP BY n.id ORDER BY n.sort_order, n.id
        `),
    ]);
    return { trends, nomination_votes };
}
