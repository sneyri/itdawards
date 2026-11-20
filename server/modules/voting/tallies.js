export const activeVoting = `
    s.voting_open AND (s.opens_at IS NULL OR s.opens_at <= clock_timestamp())
    AND (s.closes_at IS NULL OR s.closes_at > clock_timestamp())
`;

export const voteTotals = `
    count(v.id)::int AS vote_count,
    count(v.id) FILTER (WHERE v.voter_role <> 'JURY')::int AS user_votes,
    count(v.id) FILTER (WHERE v.voter_role = 'JURY')::int AS jury_votes,
    coalesce(sum(v.weight), 0)::bigint AS weighted_score
`;
