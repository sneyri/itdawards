import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pool from '../../database/db.js';
import { hashSession } from '../auth/sessions.js';
import { publicOrigin, secureCookies } from '../../config.js';
import { createApp } from '../../app.js';

const juryToken = 'a'.repeat(64);
const secondJuryToken = 'c'.repeat(64);
const participantToken = 'b'.repeat(64);
const managerToken = 'd'.repeat(64);
const sessionCookie = secureCookies ? '__Host-itd_session' : 'itd_session';
const juryId = '00000000-0000-4000-8000-000000000001';
const participantId = '00000000-0000-4000-8000-000000000002';
const secondJuryId = '00000000-0000-4000-8000-000000000003';
const managerId = '00000000-0000-4000-8000-000000000004';
const nominations = [
    { id: 1, title: 'Трек года', sort_order: 1, nominees: [
        { id: 11, name: 'Исполнитель один', sort_order: 1 },
        { id: 12, name: 'Исполнитель два', sort_order: 2 },
    ] },
    { id: 2, title: 'KING ITD', sort_order: 2, nominees: [
        { id: 21, name: 'Участник', sort_order: 1 },
    ] },
];
const juryVotes = new Map();
const legacyReviews = [];
const originalQuery = pool.query;
let server;
let baseUrl;

before(async () => {
    pool.query = async (query, values = []) => {
        if (query.includes('SELECT u.id, u.display_name, u.role FROM sessions')) {
            const token = [
                [juryToken, { id: juryId, display_name: 'Жюри', role: 'JURY' }],
                [secondJuryToken, { id: secondJuryId, display_name: 'Второй член жюри', role: 'JURY' }],
                [participantToken, { id: participantId, display_name: 'Участник', role: 'USER' }],
                [managerToken, { id: managerId, display_name: 'Администратор', role: 'MANAGER' }],
            ].find(([value]) => values[0]?.equals(hashSession(value)));
            return { rows: token ? [token[1]] : [] };
        }

        if (query.includes('INSERT INTO jury_reviews')) {
            const [nominationId, , content] = values;
            if (!nominations.some(nomination => nomination.id === nominationId)) return { rows: [] };
            const review = {
                id: legacyReviews.length + 1,
                nomination_id: nominationId,
                content,
                created_at: '2026-11-23T00:00:00.000Z',
            };
            legacyReviews.push({ ...review, nomination_title: 'Трек года' });
            return { rows: [review] };
        }

        if (query.includes('SELECT n.id AS nomination_id, v.nominee_id')) {
            const [nominationId, userId] = values;
            const nomination = nominations.find(entry => entry.id === nominationId);
            if (!nomination) return { rows: [] };
            const vote = juryVotes.get(`${userId}:${nominationId}`);
            if (!vote) return { rows: [{ nomination_id: nominationId, nominee_id: null }] };
            const nominee = nomination.nominees.find(entry => entry.id === vote.nominee_id);
            return { rows: [{
                nomination_id: nominationId,
                nominee_id: vote.nominee_id,
                nominee_name: nominee?.name,
                justification: vote.justification,
                updated_at: vote.updated_at,
            }] };
        }

        if (query.includes('INSERT INTO jury_votes')) {
            assert.match(query, /ON CONFLICT \(jury_id, nomination_id\) DO UPDATE/);
            const [nominationId, nomineeId, userId, justification] = values;
            const nomination = nominations.find(entry => entry.id === nominationId);
            if (!nomination?.nominees.some(nominee => nominee.id === nomineeId)) return { rows: [] };
            const key = `${userId}:${nominationId}`;
            const vote = {
                nomination_id: nominationId,
                nominee_id: nomineeId,
                justification,
                updated_at: '2026-11-23T01:00:00.000Z',
            };
            juryVotes.set(key, vote);
            return { rows: [vote] };
        }

        if (query.includes('SELECT id, title FROM nominations')) {
            const nominationId = values[0];
            return { rows: nominations.filter(entry => nominationId === null || entry.id === nominationId)
                .map(({ id, title }) => ({ id, title })) };
        }

        if (query.includes('count(v.nomination_id)::int AS vote_count')) {
            const nominationId = values[0];
            const entries = nominations.filter(nomination => nominationId === null || nomination.id === nominationId)
                .flatMap(nomination => nomination.nominees.map(nominee => ({
                    nomination_id: nomination.id,
                    nomination_title: nomination.title,
                    nominee_id: nominee.id,
                    nominee_name: nominee.name,
                    vote_count: [...juryVotes.values()].filter(vote =>
                        vote.nomination_id === nomination.id && vote.nominee_id === nominee.id).length,
                })));
            return { rows: entries };
        }

        if (query.includes('FROM jury_votes v')) {
            const nominationId = values[0];
            const rows = [...juryVotes.values()]
                .filter(vote => nominationId === null || vote.nomination_id === nominationId)
                .map(vote => {
                    const nomination = nominations.find(entry => entry.id === vote.nomination_id);
                    return {
                        nomination_id: nomination.id,
                        nomination_title: nomination.title,
                        nominee_id: vote.nominee_id,
                        nominee_name: nomination.nominees.find(entry => entry.id === vote.nominee_id)?.name,
                        justification: vote.justification,
                        updated_at: vote.updated_at,
                    };
                });
            return { rows };
        }

        if (query.includes('FROM jury_reviews review')) {
            const nominationId = values[0];
            return { rows: legacyReviews.filter(review => nominationId === null || review.nomination_id === nominationId)
                .map(({ nomination_id, nomination_title, content, created_at }) => ({
                    nomination_id, nomination_title, nominee_id: null, nominee_name: null,
                    justification: content, created_at,
                })) };
        }

        throw new Error('Unexpected database query in jury vote test.');
    };

    server = createApp().listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    pool.query = originalQuery;
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function send(path, method, body, token) {
    return fetch(`${baseUrl}/api${path}`, {
        method,
        headers: {
            origin: publicOrigin || baseUrl,
            'content-type': 'application/json',
            ...(token ? { cookie: `${sessionCookie}=${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
}

const get = (path, token) => send(path, 'GET', undefined, token);
const post = (path, body, token) => send(path, 'POST', body, token);

test('jury voting is role-protected, nomination-scoped, editable, and anonymous to administrators', async () => {
    const unauthenticated = await get('/jury/votes/1');
    assert.equal(unauthenticated.status, 401);
    assert.equal((await unauthenticated.json()).error.code, 'login_required');

    const participantRead = await get('/jury/votes/1', participantToken);
    assert.equal(participantRead.status, 404);
    assert.equal((await participantRead.json()).error.code, 'forbidden');
    const participantWrite = await post('/jury/votes', {
        nomination_id: 1, nominee_id: 11, justification: 'Не должен пройти',
    }, participantToken);
    assert.equal(participantWrite.status, 404);
    assert.equal(juryVotes.size, 0);

    assert.equal((await get('/jury/votes/not-an-id', juryToken)).status, 400);
    assert.equal((await post('/jury/votes', {
        nomination_id: 1, nominee_id: 21, justification: 'Номинант из другой категории',
    }, juryToken)).status, 404);
    assert.equal((await post('/jury/votes', {
        nomination_id: 1, nominee_id: 11, justification: ' '.repeat(2),
    }, juryToken)).status, 400);
    assert.equal((await post('/jury/votes', {
        nomination_id: 1, nominee_id: 11, justification: 'x'.repeat(257),
    }, juryToken)).status, 400);

    const first = await post('/jury/votes', {
        nomination_id: 1, nominee_id: 11, justification: 'Сильная работа.',
    }, juryToken);
    assert.equal(first.status, 200);
    assert.deepEqual(Object.keys((await first.json()).data).sort(),
        ['justification', 'nomination_id', 'nominee_id', 'updated_at']);
    assert.equal(juryVotes.size, 1);

    const edited = await post('/jury/votes', {
        nomination_id: 1, nominee_id: 12, justification: 'Меняю выбор и обоснование.',
    }, juryToken);
    assert.equal(edited.status, 200);
    assert.equal(juryVotes.size, 1);
    assert.equal((await edited.json()).data.nominee_id, 12);

    const second = await post('/jury/votes', {
        nomination_id: 1, nominee_id: 12, justification: 'x'.repeat(256),
    }, secondJuryToken);
    assert.equal(second.status, 200);
    assert.equal(juryVotes.size, 2);

    const ownVote = await get('/jury/votes/1', juryToken);
    assert.deepEqual((await ownVote.json()).data, {
        nomination_id: 1,
        nominee_id: 12,
        nominee_name: 'Исполнитель два',
        justification: 'Меняю выбор и обоснование.',
        updated_at: '2026-11-23T01:00:00.000Z',
    });

    const legacy = await post('/jury/reviews', {
        nomination_id: 1, content: 'Старый отзыв без выбранного номинанта.',
    }, juryToken);
    assert.equal(legacy.status, 201);
    assert.equal((await legacy.json()).data.content, 'Старый отзыв без выбранного номинанта.');

    assert.equal((await get('/admin/jury-votes')).status, 401);
    const participantAdmin = await get('/admin/jury-votes', participantToken);
    assert.equal(participantAdmin.status, 404);
    const adminResponse = await get('/admin/jury-votes', managerToken);
    assert.equal(adminResponse.status, 200);
    const adminData = (await adminResponse.json()).data;
    assert.equal(adminData.counts.find(row => row.nominee_id === 12).vote_count, 2);
    assert.equal(adminData.votes.length, 2);
    assert.equal(adminData.legacy_reviews.length, 1);
    assert.deepEqual(Object.keys(adminData.votes[0]).sort(),
        ['justification', 'nomination_id', 'nomination_title', 'nominee_id', 'nominee_name', 'updated_at']);
    assert.equal(JSON.stringify(adminData).includes('jury_id'), false);
    assert.equal(JSON.stringify(adminData).includes('display_name'), false);
    assert.equal(JSON.stringify(adminData).includes('Жюри'), false);

    const filtered = await get('/admin/jury-votes?nomination_id=2', managerToken);
    assert.deepEqual((await filtered.json()).data.nominations.map(entry => entry.id), [2]);
    assert.equal((await get('/admin/jury-votes?nomination_id=1x', managerToken)).status, 400);

    const retiredUpload = await post('/jury/upload', { nomination_id: 1, content: 'Review' }, juryToken);
    assert.equal(retiredUpload.status, 404);
    assert.equal((await retiredUpload.json()).error.code, 'route_not_found');
});
