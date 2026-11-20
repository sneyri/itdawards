import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import pool, { transaction } from './db.js';

const sources = [
    ['Добряк года.txt', [['Добряк года', 12]]],
    ['Квин года.txt', [['QUEEN ITD', 12, 'QUEEN ИТД']]],
    ['Король итд.txt', [['KING ITD', 11, 'KING ИТД']]],
    ['СМИ годаа.txt', [['СМИ года', 10, 'Новостной паблик', 'Новостной паблик года']]],
    ['Стример года.txt', [['Стример года', 8]]],
    ['Художники.txt', [['Художник года', 12]]],
    ['щит фото интерв.txt', [
        ['Интервьюер года', 8, 'Интервьюер'],
        ['Фотограф года', 12],
        ['Щитпостер года', 13, 'Шитпостер года'],
    ]],
];

const itdHost = new URL('https://итд.com').hostname;

function profile(link) {
    const url = URL.parse(link);
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return null;
    const pattern = url.hostname === itdHost ? /^\/@([\w]+)\/?$/ :
        ['t.me', 'twitch.tv', 'www.twitch.tv'].includes(url.hostname) ? /^\/([\w]+)\/?$/ : null;
    const username = pattern?.exec(url.pathname)?.[1];
    if (!username) return null;
    return { username, key: url.hostname.replace(/^www\./, '') + '/' + username.toLowerCase(), link };
}

export async function readRoster(directory) {
    const roster = [];
    const issues = [];
    for (const [file, sections] of sources) {
        const entries = new Map(sections.map(([title]) => [title, new Map()]));
        let current = sections.length === 1 ? entries.values().next().value : null;
        for (const [index, raw] of (await readFile(join(directory, file), 'utf8')).split(/\r?\n/).entries()) {
            const line = raw.trim();
            const heading = entries.get(line.replace(/:$/, ''));
            if (heading) current = heading;
            if (!/https?:|www\./i.test(line)) continue;
            const participant = profile(line);
            if (!current || !participant || current.has(participant.key)) {
                issues.push(file + ':' + (index + 1) + ' ' + line);
                continue;
            }
            current.set(participant.key, participant);
        }
        for (const [title, expected, ...aliases] of sections) {
            const participants = [...entries.get(title).values()];
            if (participants.length !== expected) issues.push(title + ' — ' + participants.length + ' из ' + expected);
            roster.push({ title, aliases, participants });
        }
    }
    if (issues.length) throw new Error('Проверьте исходные списки:\n' + issues.join('\n'));
    return roster;
}

async function planSync(client, roster) {
    const { rows: nominations } = await client.query(
        'SELECT id, title FROM nominations WHERE NOT archived AND NOT suggestions_preview ORDER BY id',
    );
    const { rows: nominees } = await client.query(`
        SELECT id, nomination_id, name, handle, link_url, sort_order, archived,
            (SELECT count(*)::int FROM votes WHERE nominee_id = nominees.id) AS votes
        FROM nominees ORDER BY id
    `);
    const plan = { renamed: [], added: [], updated: [], archived: [], conflicts: [], counts: {} };
    for (const { title, aliases, participants } of roster) {
        const matchingNominations = nominations.filter((row) => [title, ...aliases].includes(row.title));
        if (matchingNominations.length !== 1) {
            plan.conflicts.push({ title, nominations: matchingNominations });
            continue;
        }
        const [nomination] = matchingNominations;
        if (nomination.title !== title) plan.renamed.push({ ...nomination, after: title });
        const existing = nominees.filter((row) => row.nomination_id === nomination.id);
        const retained = new Set();
        for (const [index, participant] of participants.entries()) {
            const matches = existing.filter((row) => {
                if (row.link_url) return profile(row.link_url)?.key === participant.key;
                return participant.key === itdHost + '/' + row.handle?.toLowerCase().replace(/^@/, '');
            });
            if (matches.length > 1) {
                plan.conflicts.push({ title, link: participant.link, matches });
                continue;
            }
            const [match] = matches;
            const order = index + 1;
            const entry = { title, nominationId: nomination.id, link: participant.link, order };
            if (!match) {
                const known = nominees.filter((row) => profile(row.link_url)?.key === participant.key);
                const names = [...new Set(known.map((row) => row.name))];
                plan.added.push({ ...entry, name: names.length === 1 ? names[0] : participant.username, handle: '@' + participant.username });
                continue;
            }
            retained.add(match.id);
            if (match.archived || match.link_url !== participant.link || match.sort_order !== order) {
                plan.updated.push({ ...entry, id: match.id, name: match.name, votes: match.votes, restored: match.archived });
            }
        }
        plan.archived.push(...existing.filter((row) => !row.archived && !retained.has(row.id)));
        plan.counts[title] = participants.length;
    }
    return plan;
}

async function voteFingerprint(client) {
    const { rows: [result] } = await client.query(`
        SELECT count(*)::int AS count, md5(string_agg(to_jsonb(votes)::text, ',' ORDER BY id)) AS fingerprint FROM votes
    `);
    return result;
}

async function applyPlan(client, plan, roster) {
    const before = await voteFingerprint(client);
    for (const row of plan.renamed) {
        await client.query('UPDATE nominations SET title = $2 WHERE id = $1', [row.id, row.after]);
    }
    for (const row of plan.added) {
        const { rows: [added] } = await client.query(`
            INSERT INTO nominees (nomination_id, name, handle, link_url, sort_order)
            VALUES ($1, $2, $3, $4, $5) RETURNING id
        `, [row.nominationId, row.name, row.handle, row.link, row.order]);
        row.id = added.id;
    }
    for (const row of plan.updated) {
        await client.query('UPDATE nominees SET link_url = $2, sort_order = $3, archived = false WHERE id = $1',
            [row.id, row.link, row.order]);
    }
    if (plan.archived.length) {
        await client.query('UPDATE nominees SET archived = true WHERE id = ANY($1::int[])',
            [plan.archived.map((row) => row.id)]);
    }

    const verified = await planSync(client, roster);
    if (['renamed', 'added', 'updated', 'archived', 'conflicts'].some((key) => verified[key].length)) {
        throw new Error('После записи каталог отличается от исходных списков.');
    }
    const after = await voteFingerprint(client);
    if (before.count !== after.count || before.fingerprint !== after.fingerprint) {
        throw new Error('Содержимое голосов изменилось во время синхронизации.');
    }
    const changed = ['renamed', 'added', 'updated', 'archived'].some((key) => plan[key].length);
    const audit = changed ? await client.query(`
        INSERT INTO audit_logs (action, target_type, target_id, details)
        VALUES ('nominee_roster_synced', 'catalog', 'telegram-roster', $1) RETURNING id
    `, [{ ...plan, votesPreserved: after.count }]) : null;
    return { counts: verified.counts, votesPreserved: after.count, auditId: audit?.rows[0].id ?? null };
}

async function main() {
    const [directory, mode, ...extra] = process.argv.slice(2);
    if (!directory || (mode && mode !== '--apply') || extra.length) {
        throw new Error('Использование: db:sync-nominees -- <каталог с файлами> [--apply]');
    }
    const roster = await readRoster(directory);
    const apply = mode === '--apply';
    const result = await transaction(async (client) => {
        if (apply) {
            await client.query("SET LOCAL lock_timeout = '5s'");
            await client.query('SELECT id FROM settings WHERE id = 1 FOR UPDATE');
            await client.query('LOCK TABLE nominations, nominees, votes IN SHARE ROW EXCLUSIVE MODE');
        } else {
            await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        }
        const plan = await planSync(client, roster);
        console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', ...plan }, null, 2));
        if (plan.conflicts.length) throw new Error('Проверьте неоднозначные совпадения. Изменения отменены.');
        return apply ? applyPlan(client, plan, roster) : null;
    });
    if (result) console.log(JSON.stringify({ committed: true, ...result }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        await main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}
