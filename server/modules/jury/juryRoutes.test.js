import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pool from '../../database/db.js';
import { hashSession } from '../auth/sessions.js';
import { publicOrigin, secureCookies } from '../../config.js';
import { createApp } from '../../app.js';

const juryToken = 'a'.repeat(64);
const participantToken = 'b'.repeat(64);
const sessionCookie = secureCookies ? '__Host-itd_session' : 'itd_session';
const juryId = '00000000-0000-4000-8000-000000000001';
const participantId = '00000000-0000-4000-8000-000000000002';
const insertedReviews = [];
const originalQuery = pool.query;
let server;
let baseUrl;

before(async () => {
    pool.query = async (query, values = []) => {
        if (query.includes('SELECT u.id, u.display_name, u.role FROM sessions')) {
            const user = values[0]?.equals(hashSession(juryToken))
                ? { id: juryId, display_name: 'Жюри', role: 'JURY' }
                : values[0]?.equals(hashSession(participantToken))
                    ? { id: participantId, display_name: 'Участник', role: 'USER' }
                    : null;
            return { rows: user ? [user] : [] };
        }

        if (query.includes('INSERT INTO jury_reviews')) {
            insertedReviews.push(values);
            if (values[0] === 999) return { rows: [] };
            return {
                rows: [{
                    id: insertedReviews.length,
                    nomination_id: values[0],
                    content: values[2],
                    created_at: '2026-11-23T00:00:00.000Z',
                }],
            };
        }

        throw new Error('Unexpected database query in jury review test.');
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

async function post(path, body, token) {
    return fetch(`${baseUrl}/api${path}`, {
        method: 'POST',
        headers: {
            origin: publicOrigin || baseUrl,
            'content-type': 'application/json',
            ...(token ? { cookie: `${sessionCookie}=${token}` } : {}),
        },
        body: JSON.stringify(body),
    });
}

test('jury reviews are mounted, role-protected, validated and persisted independently', async () => {
    const unauthenticated = await post('/jury/reviews', { nomination_id: 1, content: 'Review' });
    assert.equal(unauthenticated.status, 401);
    assert.equal((await unauthenticated.json()).error.code, 'login_required');

    const participant = await post('/jury/reviews', { nomination_id: 1, content: 'Review' }, participantToken);
    assert.equal(participant.status, 404);
    assert.equal((await participant.json()).error.code, 'forbidden');
    assert.equal(insertedReviews.length, 0);

    const empty = await post('/jury/reviews', { nomination_id: 1, content: '   ' }, juryToken);
    assert.equal(empty.status, 400);

    const tooLong = await post('/jury/reviews', { nomination_id: 1, content: 'x'.repeat(257) }, juryToken);
    assert.equal(tooLong.status, 400);

    const maximumLength = await post('/jury/reviews', { nomination_id: 1, content: 'x'.repeat(256) }, juryToken);
    assert.equal(maximumLength.status, 201);
    assert.equal(insertedReviews.at(-1)[2].length, 256);

    const nullCharacter = await post('/jury/reviews', { nomination_id: 1, content: 'bad\u0000text' }, juryToken);
    assert.equal(nullCharacter.status, 400);

    const missingNomination = await post('/jury/reviews', { nomination_id: 999, content: 'Review' }, juryToken);
    assert.equal(missingNomination.status, 404);
    assert.equal((await missingNomination.json()).error.code, 'nomination_not_found');

    const success = await post('/jury/reviews', { nomination_id: 1, content: '  Add a category  ' }, juryToken);
    assert.equal(success.status, 201);
    assert.deepEqual((await success.json()).data, {
        id: insertedReviews.length,
        nomination_id: 1,
        content: 'Add a category',
        created_at: '2026-11-23T00:00:00.000Z',
    });
    assert.deepEqual(insertedReviews.at(-1), [1, juryId, 'Add a category']);

    const retiredUpload = await post('/jury/upload', { nomination_id: 1, content: 'Review' }, juryToken);
    assert.equal(retiredUpload.status, 404);
    assert.equal((await retiredUpload.json()).error.code, 'route_not_found');
});
