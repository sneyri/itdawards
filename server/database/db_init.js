import { readFile } from 'node:fs/promises';
import pool from './db.js';

try {
    const schema = await readFile(new URL('./init.sql', import.meta.url), 'utf8');
    const seed = process.argv.includes('--seed');
    const catalog = process.argv.includes('--catalog');
    if (seed && catalog) throw new Error('Запускайте --seed и --catalog отдельно.');
    const data = seed || catalog
        ? await readFile(new URL(catalog ? './catalog.sql' : './seed.sql', import.meta.url), 'utf8')
        : null;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query(schema);
        if (data) {
            await client.query('LOCK TABLE nominations IN SHARE ROW EXCLUSIVE MODE');
            await client.query(data);
        }
        await client.query('COMMIT');
        console.log(catalog ? 'Каталог обновлён.' : seed ? 'Схема готова. Пустой каталог заполняется демоданными.' : 'Схема готова.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
} catch (error) {
    console.error('Ошибка инициализации PostgreSQL:', error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
