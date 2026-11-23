import pool from '../../database/db.js';
import { activeVoting, voteTotals } from '../voting/tallies.js';
import { auditQuery } from './audit.js';

async function getDashboardCharts() {
    const [{ rows: trends }, { rows: nominationVotes }] = await Promise.all([
        pool.query(`
            WITH days AS (
                SELECT generate_series((now() AT TIME ZONE 'UTC')::date - 29,
                    (now() AT TIME ZONE 'UTC')::date, interval '1 day')::date AS day
            ), ballots AS (
                SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS votes,
                    count(DISTINCT user_id)::int AS active_users
                FROM votes WHERE voter_role IS NOT NULL
                    AND created_at >= ((SELECT min(day) FROM days)::timestamp AT TIME ZONE 'UTC')
                GROUP BY 1
            ), accounts AS (
                SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS registrations
                FROM users WHERE last_login_at IS NOT NULL
                    AND created_at >= ((SELECT min(day) FROM days)::timestamp AT TIME ZONE 'UTC')
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
            FROM nominations n LEFT JOIN votes v
                ON v.nomination_id = n.id AND v.voter_role IS NOT NULL
            GROUP BY n.id ORDER BY n.sort_order, n.id
        `),
    ]);
    return { trends, nomination_votes: nominationVotes };
}

export async function getStats(req, res) {
    const [{ rows: [stats] }, { rows: recent_actions }, charts] = await Promise.all([
        pool.query(`
            WITH accounts AS (
                SELECT count(*)::int AS users,
                    count(*) FILTER (WHERE last_login_at IS NOT NULL)::int AS registered,
                    count(*) FILTER (WHERE role IN ('MANAGER', 'SUPERADMIN'))::int AS administrators,
                    count(*) FILTER (WHERE role = 'JURY')::int AS jurors
                FROM users
            ), ballots AS (
                SELECT count(DISTINCT v.user_id)::int AS voters, ${voteTotals}
                FROM votes v WHERE v.voter_role IS NOT NULL
            )
            SELECT accounts.*, ballots.*,
                (SELECT count(*)::int FROM nominations) AS nominations,
                (SELECT count(*)::int FROM nominees) AS nominees,
                (SELECT count(*)::int FROM invitation_codes AS invitation
                    JOIN auth_codes AS code ON code.user_id = invitation.account_id AND code.invitation_id = invitation.id
                    WHERE invitation.revoked_at IS NULL AND invitation.use_count < invitation.max_uses
                        AND (invitation.expires_at IS NULL OR invitation.expires_at > now())
                        AND (code.expires_at IS NULL OR code.expires_at > now())
                        AND code.used_at IS NULL) AS invitations_active,
                (SELECT ${activeVoting} FROM settings s WHERE s.id = 1) AS voting_open
            FROM accounts CROSS JOIN ballots
        `),
        pool.query(`${auditQuery(req.user.role === 'SUPERADMIN' ? '' : "WHERE a.target_type IN ('nomination', 'nominee')")} LIMIT 8`),
        getDashboardCharts(),
    ]);
    const { vote_count: votes, weighted_score, ...counts } = stats;
    res.json({ data: { ...counts, votes, weighted_score: Number(weighted_score), role: req.user.role,
        viewer_id: req.user.id, recent_actions, ...charts } });
}
