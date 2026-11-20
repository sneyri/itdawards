import catalogue from './official-catalog.json' with { type: 'json' };

const importVersion = 'official-catalog.json';
const legacyTitles = {
    'KING ITD': 'KING ИТД',
    'QUEEN ITD': 'QUEEN ИТД',
    'СМИ года': 'Новостной паблик года',
    'Интервьюер года': 'Интервьюер',
    'Щитпостер года': 'Шитпостер года',
};

export async function importOfficialCatalog(client) {
    // Voting and catalog writes also lock settings before touching nominations or votes.
    const { rows: [settings] } = await client.query(`
        SELECT voting_open, results_published FROM settings WHERE id = 1 FOR UPDATE
    `);
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [importVersion]);
    if (applied.rowCount) return null;
    if (settings.voting_open || settings.results_published) {
        throw new Error('Закройте голосование и снимите результаты с публикации перед импортом каталога.');
    }

    // Only an exact demo ballot may be archived outside the listed categories.
    const { rowCount: archivedNominations } = await client.query(`
        UPDATE nominations AS nomination SET archived = true, status = 'closed'
        FROM (VALUES
            ('Ивент года', ARRAY['Событие А', 'Событие Б']),
            ('Сквад года', ARRAY['Команда А', 'Команда Б']),
            ('Баннер года', ARRAY['Работа А', 'Работа Б']),
            ('Интервью года', ARRAY['Беседа А', 'Беседа Б'])
        ) AS demo(title, names)
        WHERE nomination.title = demo.title AND NOT nomination.archived AND NOT nomination.suggestions_preview
            AND ARRAY(SELECT name FROM nominees WHERE nomination_id = nomination.id ORDER BY sort_order, id) = demo.names
    `);

    for (const [index, nomination] of catalogue.entries()) {
        const nominationId = await saveNomination(client, nomination.title, (index + 1) * 10);
        await saveNominees(client, nominationId, nomination.title, nomination.nominees);
    }

    const summary = {
        nominations: catalogue.length,
        nominees: catalogue.reduce((total, nomination) => total + nomination.nominees.length, 0),
        archivedNominations,
    };
    await client.query(`
        INSERT INTO audit_logs (action, target_type, target_id, details)
        VALUES ('official_catalog_imported', 'catalog', $1, $2)
    `, [importVersion, summary]);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [importVersion]);
    return summary;
}

async function saveNomination(client, title, sortOrder) {
    const candidateTitles = [title];
    if (legacyTitles[title]) candidateTitles.push(legacyTitles[title]);
    const { rows: nominations } = await client.query(`
        SELECT id FROM nominations WHERE title = ANY($1::text[]) AND NOT archived AND NOT suggestions_preview
    `, [candidateTitles]);
    if (nominations.length > 1) throw new Error(`Несколько действующих номинаций для «${title}». Уточните состав в админке.`);
    if (nominations.length === 1) {
        const nominationId = nominations[0].id;
        await client.query('UPDATE nominations SET title = $2, sort_order = $3 WHERE id = $1', [nominationId, title, sortOrder]);
        return nominationId;
    }
    const { rows: [newNomination] } = await client.query(`
        INSERT INTO nominations (title, sort_order, status) VALUES ($1, $2, 'open') RETURNING id
    `, [title, sortOrder]);
    return newNomination.id;
}

async function saveNominees(client, nominationId, title, names) {
    const { rows: nominees } = await client.query(`
        SELECT id, name, archived FROM nominees WHERE nomination_id = $1 AND name = ANY($2::text[])
    `, [nominationId, names]);
    const nomineeIds = names.map((name) => {
        const matches = nominees.filter((nominee) => nominee.name === name);
        const active = matches.filter((nominee) => !nominee.archived);
        const eligible = active.length ? active : matches;
        if (eligible.length > 1) throw new Error(`Несколько записей «${name}» в «${title}». Уточните состав в админке.`);
        return eligible[0]?.id ?? null;
    });

    // Hidden candidates keep their identifiers and votes. Only exact names can carry votes into the new roster.
    await client.query(`
        UPDATE nominees SET archived = true
        WHERE nomination_id = $1 AND NOT archived AND id <> ALL($2::int[])
    `, [nominationId, nomineeIds.filter((id) => id !== null)]);
    await client.query(`
        UPDATE nominees SET archived = false, sort_order = roster.position
        FROM unnest($1::int[]) WITH ORDINALITY AS roster(nominee_id, position)
        WHERE nominees.id = roster.nominee_id
    `, [nomineeIds]);
    await client.query(`
        INSERT INTO nominees (nomination_id, name, sort_order)
        SELECT $1, name, position
        FROM unnest($2::text[], $3::int[]) WITH ORDINALITY AS roster(name, nominee_id, position)
        WHERE nominee_id IS NULL
        ORDER BY position
    `, [nominationId, names, nomineeIds]);
}
