import pool, { transaction } from './db.js';
import { parseTelegramId } from '../modules/auth/telegramAuth.js';

try {
    const telegramId = parseTelegramId(process.argv[2]);
    if (!telegramId || process.argv.length !== 3) throw new Error('Передайте точный числовой Telegram ID.');
    const outcome = await transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(2026, 2)');
        const { rows: [admin] } = await client.query(`
            SELECT telegram_id FROM users WHERE role = 'SUPERADMIN' AND NOT blocked LIMIT 1
        `);
        if (admin) return admin.telegram_id === telegramId ? 'already_set' : 'admin_exists';
        const { rows: [user] } = await client.query(`
            INSERT INTO users (telegram_id, role) VALUES ($1, 'SUPERADMIN')
            ON CONFLICT (telegram_id) DO UPDATE SET role = 'SUPERADMIN', blocked = false
            RETURNING id
        `, [telegramId]);
        await client.query(`
            INSERT INTO audit_logs (action, target_type, target_id, details)
            VALUES ('user.bootstrap_admin', 'user', $1, '{"source":"cli"}')
        `, [user.id]);
        return 'created';
    });
    if (outcome === 'admin_exists') throw new Error('SUPERADMIN уже есть. Используйте панель управления.');
    console.log(outcome === 'created' ? 'Первый SUPERADMIN назначен.' : 'Этому аккаунту уже назначен SUPERADMIN.');
} catch (error) {
    console.error(error.code ? `Ошибка PostgreSQL: ${error.code}` : error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
