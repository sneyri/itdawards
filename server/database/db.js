import { Pool } from 'pg';

export const botPreviewDatabase = 'itd_awards_bot_preview';

export const connectionOptions = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.argv.includes('--bot-preview') ? botPreviewDatabase : process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    connectionTimeoutMillis: 5000,
};

const pool = new Pool(connectionOptions);
pool.on('error', (error) => console.error('PostgreSQL:', error.code ?? error.message));

export default pool;
