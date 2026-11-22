import { Pool } from 'pg';

export const botPreviewDatabase = 'itd_awards_bot_preview';
export const isBotPreview = process.argv.includes('--bot-preview');
const configuredMax = Number.parseInt(process.env.DB_POOL_MAX ?? '10', 10);

export const connectionOptions = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: isBotPreview ? botPreviewDatabase : process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 10,
};

const pool = new Pool(connectionOptions);
pool.on('error', (error) => console.error('PostgreSQL:', error.code ?? error.name));

export async function transaction(run, source = pool) {
    const client = await source.connect();
    let rollbackError;
    try {
        await client.query('BEGIN');
        const value = await run(client);
        await client.query('COMMIT');
        return value;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (cause) {
            rollbackError = cause;
        }
        throw error;
    } finally {
        client.release(rollbackError);
    }
}

export default pool;
