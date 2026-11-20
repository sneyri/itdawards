import { createApp } from './app.js';
import pool from './database/db.js';

const port = process.env.PORT || 3000;

try {
    const { rowCount } = await pool.query('SELECT id FROM settings WHERE id = 1');
    if (!rowCount) throw new Error('Настройки голосования отсутствуют.');
} catch (error) {
    console.error('Не удалось открыть PostgreSQL. Проверьте настройки и выполните npm run db:init.', error.code ?? error.name);
    await pool.end();
    process.exit(1);
}
// Bind IPv4 loopback explicitly so localhost works with clients using IPv4.
const host = '127.0.0.1';
const server = createApp().listen(port, host);
server.once('listening', () => {
    const listeningPort = server.address().port;
    console.log(`ITD Awards — http://${host}:${listeningPort}`);
    process.send?.({ port: listeningPort });
});

server.once('error', async (error) => {
    console.error('Ошибка запуска Express:', error.code ?? error.name);
    process.exitCode = 1;
    await pool.end();
});

function stop() {
    server.close(() => pool.end());
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
