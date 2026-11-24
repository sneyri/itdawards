import assert from 'node:assert/strict';
import { test } from 'node:test';
import pool from '../../database/db.js';
import { readCombinedVotes, readOwnVotes } from './voteReader.js';

const userId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000002';
const userVotes = [
    {
        nomination_sort_order: 1, nomination_id: 7, nominee_id: 11,
        nomination_title: 'Тестовая номинация', nominee_name: 'Первый номинант',
        source: 'votes', voter_role: 'JURY', weight: 5, justification: null,
        created_at: '2026-11-20T00:00:00.000Z', updated_at: null,
        user_id: userId,
    },
    {
        nomination_sort_order: 1, nomination_id: 7, nominee_id: 12,
        nomination_title: 'Тестовая номинация', nominee_name: 'Второй номинант',
        source: 'votes', voter_role: 'USER', weight: 1, justification: null,
        created_at: '2026-11-21T00:00:00.000Z', updated_at: null,
        user_id: otherUserId,
    },
];
const juryVotes = [
    {
        nomination_sort_order: 1, nomination_id: 7, nominee_id: 12,
        nomination_title: 'Тестовая номинация', nominee_name: 'Второй номинант',
        source: 'jury_votes', voter_role: 'JURY', weight: null, justification: 'Отдельное обоснование жюри.',
        created_at: '2026-11-22T00:00:00.000Z', updated_at: '2026-11-22T00:00:00.000Z',
        jury_id: userId,
    },
    {
        nomination_sort_order: 1, nomination_id: 7, nominee_id: 11,
        nomination_title: 'Тестовая номинация', nominee_name: 'Первый номинант',
        source: 'jury_votes', voter_role: 'JURY', weight: null, justification: 'Чужое обоснование.',
        created_at: '2026-11-23T00:00:00.000Z', updated_at: '2026-11-23T00:00:00.000Z',
        jury_id: otherUserId,
    },
];

function installFixtures() {
    const originalQuery = pool.query;
    const queries = [];
    pool.query = async (query, values = []) => {
        queries.push(query);
        const [voterId, nominationId] = values;
        if (query.includes('FROM votes v')) {
            return { rows: userVotes.filter((vote) =>
                (voterId === null || vote.user_id === voterId)
                && (nominationId === null || vote.nomination_id === nominationId)) };
        }
        if (query.includes('FROM jury_votes v')) {
            return { rows: juryVotes.filter((vote) =>
                (voterId === null || vote.jury_id === voterId)
                && (nominationId === null || vote.nomination_id === nominationId)) };
        }
        throw new Error('Unexpected query in vote reader test.');
    };
    return {
        queries,
        restore() {
            pool.query = originalQuery;
        },
    };
}

test('own jury votes retain both sources and never include another jury member', async () => {
    const fixtures = installFixtures();
    try {
        const votes = await readOwnVotes(userId, 'JURY', 7);
        assert.deepEqual(votes.map(({ source, nominee_id }) => ({ source, nominee_id })), [
            { source: 'votes', nominee_id: 11 },
            { source: 'jury_votes', nominee_id: 12 },
        ]);
        assert.equal(votes[1].justification, 'Отдельное обоснование жюри.');
        assert.equal(votes[0].weight, 5);
        assert.equal(votes[1].weight, null);
    } finally {
        fixtures.restore();
    }
});

test('non-jury users are read only from the ordinary ballot table', async () => {
    const fixtures = installFixtures();
    try {
        const votes = await readOwnVotes(otherUserId, 'USER', 7);
        assert.deepEqual(votes.map(({ source, nominee_id }) => ({ source, nominee_id })), [
            { source: 'votes', nominee_id: 12 },
        ]);
        assert.equal(fixtures.queries.some((query) => query.includes('FROM jury_votes v')), false);
    } finally {
        fixtures.restore();
    }
});

test('internal combined reads preserve source and same-nomination records', async () => {
    const fixtures = installFixtures();
    try {
        const votes = await readCombinedVotes(7);
        assert.equal(votes.length, 4);
        assert.equal(votes.filter((vote) => vote.nomination_id === 7).length, 4);
        assert.deepEqual(new Set(votes.map((vote) => vote.source)), new Set(['votes', 'jury_votes']));
        assert.equal(votes.filter((vote) => vote.source === 'jury_votes').length, 2);
    } finally {
        fixtures.restore();
    }
});
