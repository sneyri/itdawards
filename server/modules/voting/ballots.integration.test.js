import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import { migrate } from '../../database/migrate.js';
import { transaction } from '../../database/db.js';
import { saveVote } from './ballots.js';

const databaseUrl = process.env.ITD_TEST_DATABASE_URL;

test('vote keeps the first jury role and weight after vote changes', { skip: !databaseUrl }, async () => {
    const schema = `itd_vote_test_${randomUUID().replaceAll('-', '')}`;
    const adminPool = new Pool({ connectionString: databaseUrl });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const testPool = new Pool({
        connectionString: databaseUrl,
        options: `-c search_path=${schema}`,
    });

    try {
        await transaction(async (client) => migrate(client), testPool);

        const { rows: [user] } = await testPool.query(`
            INSERT INTO users (telegram_id, display_name, role)
            VALUES (100000001, 'Тестовое жюри', 'JURY')
            RETURNING id
        `);
        await testPool.query(`
            INSERT INTO settings (id, voting_open, opens_at, closes_at, allow_vote_changes, jury_weight)
            VALUES (1, true, NULL, NULL, true, 5)
            ON CONFLICT (id) DO UPDATE SET voting_open = true, allow_vote_changes = true, jury_weight = 5
        `);
        await testPool.query(`
            INSERT INTO nominations (title, status) VALUES ('Тестовая номинация', 'open')
            RETURNING id
        `).then(async ({ rows: [nomination] }) => {
            await testPool.query(
                'INSERT INTO nominees (nomination_id, name, sort_order) VALUES ($1, $2, 1), ($1, $3, 2)',
                [nomination.id, 'Первый номинант', 'Второй номинант'],
            );
        });
        const { rows: [nomination] } = await testPool.query(
            "SELECT id FROM nominations WHERE title = 'Тестовая номинация'",
        );
        const { rows: nominees } = await testPool.query(
            'SELECT id, name FROM nominees WHERE nomination_id = $1 ORDER BY sort_order',
            [nomination.id],
        );

        assert.equal(await transaction(
            (client) => saveVote(client, nomination.id, nominees[0].id, user.id),
            testPool,
        ), 'saved');

        await testPool.query('UPDATE settings SET jury_weight = 9 WHERE id = 1');
        assert.equal(await transaction(
            (client) => saveVote(client, nomination.id, nominees[1].id, user.id),
            testPool,
        ), 'saved');

        const { rows: [vote] } = await testPool.query(`
            SELECT nominee_id, voter_role, weight
            FROM votes
            WHERE user_id = $1 AND nomination_id = $2
        `, [user.id, nomination.id]);

        assert.equal(vote.nominee_id, nominees[1].id);
        assert.equal(vote.voter_role, 'JURY');
        assert.equal(vote.weight, 5);
    } finally {
        await testPool.end();
        await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await adminPool.end();
    }
});
