import { readFile } from 'node:fs/promises';
import pool, { transaction } from './db.js';
import { importOfficialCatalog } from './import_official_catalog.js';
import { migrate } from './migrate.js';

try {
    const seed = process.argv.includes('--seed');
    const catalog = process.argv.includes('--official-catalog') || process.argv.includes('--catalog');
    if (seed && catalog) throw new Error('Запускайте --seed и --official-catalog отдельно.');
    const result = await transaction(async (client) => {
        await migrate(client);
        if (catalog) return importOfficialCatalog(client);
        if (seed) {
            const { rows: [settings] } = await client.query('SELECT results_published FROM settings WHERE id = 1 FOR UPDATE');
            if (settings.results_published) throw new Error('Перед обновлением каталога снимите результаты с публикации.');
            await client.query('LOCK TABLE nominations IN SHARE ROW EXCLUSIVE MODE');
            await client.query(await readFile(new URL('./seed.sql', import.meta.url), 'utf8'));
        }
    });
    if (result) console.log(`Каталог обновлён. Номинаций: ${result.nominations}, номинантов: ${result.nominees}.`);
    else if (catalog) console.log('Этот состав уже импортирован.');
    else if (seed) console.log('Схема готова. Пустой каталог заполняется демоданными.');
    else console.log('Схема готова.');
} catch (error) {
    console.error('Ошибка инициализации PostgreSQL:', error.code ?? error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
