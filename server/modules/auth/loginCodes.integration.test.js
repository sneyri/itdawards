import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import { migrate } from '../../database/migrate.js';
import { transaction } from '../../database/db.js';

const databaseUrl = process.env.ITD_TEST_DATABASE_URL;

test('login code is issued and consumed once', { skip: !databaseUrl }, async () => {
    const schema = `itd_auth_test_${randomUUID().replaceAll('-', '')}`;
    const adminPool = new Pool({ connectionString: databaseUrl });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const testPool = new Pool({
        connectionString: databaseUrl,
        options: `-c search_path=${schema}`,
    });

    try {
        process.env.AUTH_CODE_SECRET = 'a'.repeat(32);
        const { consumeLoginCode, parseCode, storeLoginCode } = await import('./loginCodes.js');
        await transaction(async (client) => migrate(client), testPool);
        const { rows: [user] } = await testPool.query(`
            INSERT INTO users (telegram_id, display_name)
            VALUES (100000002, 'Тестовый участник')
            RETURNING id
        `);

        const issued = await transaction(
            (client) => storeLoginCode(client, user.id),
            testPool,
        );
        const code = issued.code.replaceAll('-', '');

        assert.equal(parseCode(code)?.length, 12);
        const consumed = await transaction(
            (client) => consumeLoginCode(client, code),
            testPool,
        );
        assert.equal(consumed?.user.id, user.id);
        assert.equal(consumed?.method, 'telegram');

        const reused = await transaction(
            (client) => consumeLoginCode(client, code),
            testPool,
        );
        assert.equal(reused, null);
    } finally {
        await testPool.end();
        await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await adminPool.end();
    }
});
