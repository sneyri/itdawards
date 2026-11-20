import { access } from 'node:fs/promises';
import pool from '../../database/db.js';
import { activeVoting } from '../voting/tallies.js';
import packageInfo from '../../package.json' with { type: 'json' };
import { sendError } from '../../middleware/errorHandler.js';
import { activitySummary, requestSummary } from './telemetry.js';

let heartbeat = null;
const heartbeatMaxAge = 70_000;
const recentErrors = [];

export function rememberSystemError(service, error) {
    const rawCode = error.code ?? error.name;
    const code = typeof rawCode === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(rawCode) ? rawCode : 'ERROR';
    const at = new Date().toISOString();
    const previous = recentErrors.findIndex(entry => entry.service === service && entry.code === code);
    if (previous >= 0) {
        const [entry] = recentErrors.splice(previous, 1);
        recentErrors.unshift({ ...entry, count: entry.count + 1, at });
    } else {
        recentErrors.unshift({ service, code, count: 1, first_at: at, at });
    }
    if (recentErrors.length > 15) recentErrors.pop();
}

export function botHeartbeat(req, res) {
    const { uptimeSeconds, telegramOk } = req.body ?? {};
    if (!Number.isInteger(uptimeSeconds) || uptimeSeconds < 0 || uptimeSeconds > 2_147_483_647
        || (typeof telegramOk !== 'boolean' && telegramOk !== null)) {
        return sendError(res, 400, 'invalid_heartbeat', 'Некорректная отметка состояния бота.');
    }
    if (telegramOk === false && heartbeat?.telegramOk !== false) {
        rememberSystemError('telegram', { code: 'TELEGRAM_UNAVAILABLE' });
    }
    heartbeat = { at: Date.now(), uptimeSeconds, telegramOk };
    return res.json({ data: { received: true } });
}

async function checkDatabase() {
    try {
        const started = performance.now();
        const { rows: [database] } = await pool.query(`SELECT
            floor(EXTRACT(EPOCH FROM clock_timestamp() - pg_postmaster_start_time()))::int AS uptime_seconds,
            to_regclass('users') IS NOT NULL AND to_regclass('sessions') IS NOT NULL
                AND to_regclass('auth_codes') IS NOT NULL AND to_regclass('login_events') IS NOT NULL AS auth_ready,
            to_regclass('votes') IS NOT NULL AND EXISTS (SELECT 1 FROM settings WHERE id = 1) AS voting_ready,
            to_regclass('catalog_images') IS NOT NULL AS media_ready`);
        return {
            postgresql: { status: 'ok', latency_ms: Math.round((performance.now() - started) * 10) / 10,
                uptime_seconds: database.uptime_seconds },
            auth: database.auth_ready,
            voting: database.voting_ready,
            media: database.media_ready,
        };
    } catch (error) {
        rememberSystemError('postgresql', error);
        return { postgresql: { status: 'down', uptime_seconds: null } };
    }
}

function readiness(available, probe) {
    return { status: available === undefined ? 'unknown' : available ? 'ok' : 'degraded', uptime_seconds: null, probe };
}

export async function readSystemStatus() {
    const [database, siteAvailable] = await Promise.all([
        checkDatabase(),
        access(new URL('../../../client/dist/index.html', import.meta.url)).then(() => true, () => false),
    ]);
    const now = Date.now();
    const botAge = heartbeat ? now - heartbeat.at : null;
    const botStatus = botAge === null ? 'unknown' : botAge > heartbeatMaxAge ? 'down'
        : heartbeat.telegramOk === false ? 'degraded' : heartbeat.telegramOk === true ? 'ok' : 'unknown';
    return {
        checked_at: new Date(now).toISOString(),
        version: packageInfo.version,
        site: { status: siteAvailable ? 'ok' : 'down', uptime_seconds: null },
        backend: { status: 'ok', uptime_seconds: Math.floor(process.uptime()) },
        postgresql: database.postgresql,
        auth: readiness(database.auth, 'schema'),
        voting: readiness(database.voting, 'settings'),
        media: readiness(database.media, 'schema'),
        telegram: {
            status: botStatus,
            uptime_seconds: botAge !== null && botAge <= heartbeatMaxAge ? heartbeat.uptimeSeconds : null,
            last_seen_at: heartbeat ? new Date(heartbeat.at).toISOString() : null,
        },
        recent_errors: recentErrors,
    };
}

export async function systemStatus(_req, res) {
    res.json({ data: await readSystemStatus() });
}

export async function nexusTelemetry(req, res) {
    const owner = req.user.role === 'SUPERADMIN';
    const [services, { rows: [stats] }, { rows: [lastEvent] }] = await Promise.all([
        readSystemStatus(),
        pool.query('SELECT ' + activeVoting + ' AS voting_active, voting_open, results_published, opens_at, closes_at, '
            + '(SELECT count(*)::int FROM votes WHERE voter_role IS NOT NULL) AS votes, clock_timestamp() AS checked_at '
            + 'FROM settings s WHERE id = 1'),
        pool.query('SELECT id, action, created_at AS at FROM audit_logs '
            + "WHERE $1::boolean OR target_type IN ('nomination', 'nominee', 'settings') ORDER BY id DESC LIMIT 1", [owner]),
    ]);
    const { voting_active, voting_open, results_published, opens_at, closes_at, checked_at, votes } = stats;
    let phase = 'closed';
    if (results_published) phase = 'published';
    else if (voting_active) phase = 'voting';
    else if (voting_open && opens_at && opens_at > checked_at) phase = 'scheduled';
    res.json({ data: {
        ...services,
        phase,
        schedule: { voting_open, results_published, opens_at, closes_at },
        stats: { ...activitySummary(), votes },
        stream: requestSummary(),
        last_event: lastEvent ?? null,
    } });
}
