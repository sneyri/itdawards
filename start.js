import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const server = spawn(process.execPath, ['server.js'], {
    cwd: fileURLToPath(new URL('./server/', import.meta.url)),
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
});
let bot;
let stopping = false;

function stop(exitCode) {
    if (stopping) return;
    stopping = true;
    process.exitCode = exitCode;
    bot?.kill();
    server.kill();
}

function stopIfChildExits(child, name) {
    child.once('error', (error) => {
        console.error(`Не удалось запустить ${name} (${error.code ?? error.name}).`);
        stop(1);
    });
    child.once('exit', (code, signal) => {
        if (stopping) return;
        console.error(`${name} завершился (${code ?? signal}).`);
        stop(code || 1);
    });
}

stopIfChildExits(server, 'Сайт');
server.once('message', ({ port }) => {
    if (stopping) return;
    // Start polling only after this copy of Express owns the listening port.
    const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
    bot = spawn(python, ['-u', 'main.py'], {
        cwd: fileURLToPath(new URL('./bot/', import.meta.url)),
        env: { ...process.env, AWARDS_SITE_API_URL: `http://localhost:${port}` },
        stdio: 'inherit',
    });
    stopIfChildExits(bot, 'Telegram-бот');
});

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
