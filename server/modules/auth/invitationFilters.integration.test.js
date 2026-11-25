import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import pool from '../../database/db.js';
import { migrate } from '../../database/migrate.js';
import { listInvitations } from './invitations.js';
const databaseUrl = process.env.ITD_TEST_DATABASE_URL;
test('invitation filters and validation', { skip: !databaseUrl }, async () => {
    const schema = `itd_invitations_test_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const isolated = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
    const originalQuery = pool.query;
    try {
        const client = await isolated.connect();
        try { await client.query('BEGIN'); await migrate(client); await client.query('COMMIT'); }
        finally { client.release(); }
        const { rows: users } = await isolated.query(`INSERT INTO users (display_name, role)
            VALUES ('Owner', 'SUPERADMIN'), ('Jury', 'JURY'), ('Member', 'USER') RETURNING id`);
        await isolated.query(`INSERT INTO invitation_codes (creator_id, account_id, role, max_uses, revoked_at)
            VALUES ($1,$2,'JURY',1,NULL), ($1,$3,'USER',1,clock_timestamp())`, users.map(user => user.id));
        pool.query = (...args) => isolated.query(...args);
        async function call(query) {
            const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
            await listInvitations({ query }, res);
            return res;
        }
        const jury = await call({ role: 'JURY', status: 'active' });
        assert.equal(jury.body.data.length, 1);
        assert.equal(jury.body.data[0].role, 'JURY');
        const revoked = await call({ status: 'revoked' });
        assert.equal(revoked.body.data.length, 1);
        assert.equal(revoked.body.data[0].role, 'USER');
        assert.equal((await call({ role: 'MANAGER' })).statusCode, 400);
        assert.equal((await call({ status: ['active', 'used'] })).statusCode, 400);
    } finally {
        pool.query = originalQuery;
        await isolated.end();
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await admin.end();
    }
});
