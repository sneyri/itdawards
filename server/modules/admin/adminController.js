import pool from '../../database/db.js';
import { activeVoting, voteTotals } from '../voting/tallies.js';
import { getDashboardCharts } from './dashboardCharts.js';
import { auditQuery } from './audit.js';

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
