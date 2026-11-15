import { Pool } from 'pg';

const { AUTH_DB_HOST, AUTH_DB_PORT, AUTH_DB_NAME, AUTH_DB_USER, AUTH_DB_PASSWORD } = process.env;
if (!AUTH_DB_NAME) throw new Error('Configure AUTH_DB_NAME in server/.env.');

export default new Pool({
    host: AUTH_DB_HOST,
    port: AUTH_DB_PORT,
    database: AUTH_DB_NAME,
    user: AUTH_DB_USER,
    password: AUTH_DB_PASSWORD,
    connectionTimeoutMillis: 4000,
});
