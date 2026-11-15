import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function startLocalAuth() {
    const { AUTH_SERVICE_URL, AUTH_AUTO_START } = process.env;
    if (!AUTH_SERVICE_URL || AUTH_AUTO_START === 'false') return;

    const url = new URL(AUTH_SERVICE_URL);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) return;

    const entry = fileURLToPath(new URL('./auth-service/index.js', import.meta.url));
    const auth = fork(entry, {
        env: { ...process.env, AUTH_PORT: url.port || '80' },
        execArgv: [],
        stdio: 'inherit',
    });

    auth.on('error', (error) => console.error('Ошибка запуска сервиса входа:', error.message));
    auth.on('exit', (code, signal) => {
        console.error('Сервис входа завершился:', signal ?? code);
    });
}
