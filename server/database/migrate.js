import { readdir, readFile } from 'node:fs/promises';

export async function migrate(client) {
    await client.query('SELECT pg_advisory_xact_lock(2026, 1)');
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name text PRIMARY KEY,
            applied_at timestamptz NOT NULL DEFAULT now()
        )
    `);
    const directory = new URL('./migrations/', import.meta.url);
    const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map(({ name }) => name));
    if (!applied.has('init.sql')) {
        await client.query(await readFile(new URL('./init.sql', import.meta.url), 'utf8'));
        await client.query("INSERT INTO schema_migrations (name) VALUES ('init.sql')");
    }
    for (const name of names) {
        if (applied.has(name)) continue;
        await client.query(await readFile(new URL(name, directory), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    }
}
