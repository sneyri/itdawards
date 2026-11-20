import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import pool, { botPreviewDatabase, connectionOptions, transaction } from './db.js';
import { migrate } from './migrate.js';

async function replacePreview(previewPool, nominations) {
    return transaction(async (client) => {
        await migrate(client);
        const { rows: [settings] } = await client.query('SELECT results_published FROM settings WHERE id = 1 FOR UPDATE');
        if (settings.results_published) throw new Error('Перед импортом снимите результаты предпросмотра с публикации.');
        await client.query('LOCK TABLE nominations IN EXCLUSIVE MODE');
        const { rowCount } = await client.query('SELECT 1 FROM nominations WHERE NOT suggestions_preview LIMIT 1');
        if (rowCount) throw new Error('В базе предпросмотра уже есть данные, созданные вручную.');

        // Keep the existing ballot in any nomination where a vote has already been recorded.
        await client.query(`
            DELETE FROM nominations AS n
            WHERE n.suggestions_preview AND NOT EXISTS (
                SELECT 1 FROM votes WHERE nomination_id = n.id
            )
        `);
        let imported = 0;
        let suggestions = 0;
        for (const nomination of nominations) {
            const { id, title, description, emoji, position } = nomination;
            const status = nomination.suggestions.length ? 'open' : 'draft';
            const { rowCount: inserted } = await client.query(`
                INSERT INTO nominations (id, title, description, emoji, sort_order, status, suggestions_preview)
                OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6, true)
                ON CONFLICT (id) DO NOTHING
            `, [id, title, description, emoji, position, status]);
            if (!inserted) continue;
            await client.query(`
                INSERT INTO nominees (nomination_id, name, sort_order)
                SELECT $1, name, position FROM unnest($2::text[]) WITH ORDINALITY AS suggestions(name, position)
            `, [id, nomination.suggestions]);
            imported++;
            suggestions += nomination.suggestions.length;
        }
        await client.query(`
            SELECT setval(pg_get_serial_sequence('nominations', 'id'), GREATEST(max(id), 1), count(*) > 0)
            FROM nominations
        `);
        return { imported, suggestions };
    }, previewPool);
}

const botDirectory = process.argv[2];
let previewPool;
try {
    if (!botDirectory) throw new Error('Передайте путь к каталогу Telegram-бота.');
    const reader = fileURLToPath(new URL('./read_bot_preview.py', import.meta.url));
    const nominations = JSON.parse(execFileSync('python', [reader, botDirectory], { encoding: 'utf8' }));
    if (!nominations.length) throw new Error('В базе бота нет номинаций.');

    const existing = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [botPreviewDatabase]);
    if (!existing.rowCount) await pool.query(`CREATE DATABASE "${botPreviewDatabase}"`);
    previewPool = new Pool({ ...connectionOptions, database: botPreviewDatabase });
    const { imported, suggestions } = await replacePreview(previewPool, nominations);
    console.log(`Предпросмотр обновлён. Загружено номинаций: ${imported}, предложений: ${suggestions}.`);
} catch (error) {
    console.error('Импорт предпросмотра:', error.message);
    process.exitCode = 1;
} finally {
    await previewPool?.end();
    await pool.end();
}
