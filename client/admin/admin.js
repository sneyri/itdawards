import { loadInvitations, loadUsers } from './access.js';
import { loadCatalog } from './catalog.js';
import { activityChart } from './charts.js';
import { loadDatabase, loadSecurity } from './management.js';
import { bindForm, button, confirmAction, date, dateInput, definition, el, formError,
    heading, nominationStatuses, notice, numbers, request, roles, selectField, status, submit, table, textField, toast, toggle } from './ui.js';

const view = document.getElementById('view');
const navigation = document.getElementById('navigation');
const panels = [
    ['overview', 'Обзор', loadOverview, '◫'],
    ['catalog', 'Каталог', loadCatalog, '◇'],
    ['voting', 'Голосование', loadVoting, '▤'],
    ['jury-votes', 'Голоса жюри', loadJuryVotes, '✦'],
    ['users', 'Пользователи', loadUsers, '◎'],
    ['invitations', 'Приглашения', loadInvitations, '＋'],
    ['system', 'Состояние сервисов', loadSystem, '⌁'],
    ['database', 'База данных', loadDatabase, '▦', 'SUPERADMIN'],
    ['security', 'Безопасность', loadSecurity, '◈', 'SUPERADMIN'],
];
const serviceNames = { site: 'Публичный сайт', backend: 'Express Backend', postgresql: 'PostgreSQL', telegram: 'Telegram-бот' };
const serviceStatuses = { ok: ['В работе', 'ok'], down: ['Недоступен', 'bad'],
    degraded: ['Нет связи с Telegram', 'bad'], unknown: ['Ожидаем сигнал', 'warn'] };
const auditLabels = {
    'settings.updated': 'Обновлены настройки голосования', 'user.updated': 'Изменены права пользователя',
    'nomination.created': 'Создана номинация', 'nomination.updated': 'Изменена номинация', 'nomination.deleted': 'Удалена номинация',
    'nominee.created': 'Добавлен номинант', 'nominee.updated': 'Изменён номинант', 'nominee.deleted': 'Удалён номинант',
    'invitation.created': 'Создано приглашение', 'invitation.revoked': 'Отозвано приглашение',
    'invitation.redeemed': 'Активировано приглашение', 'invitation.reissued': 'Повторно выдан код', 'media.uploaded': 'Загружено изображение',
};
let viewer;
let visible = [];
let pending;
let currentTelemetry;
let telemetryStarted = false;
const runtime = new AbortController();

const time = value => el('time', { datetime: value }, date(value));
const numeric = value => numbers.format(value ?? 0);
const pageHref = (label, hash, style = '') => el('a', { href: '#' + hash, class: 'button ' + style }, label);
const rowStatus = row => row.archived ? status('В архиве') : status(nominationStatuses[row.status], row.status === 'open' ? 'ok' : '');

function serviceMarker(service) {
    const [label, tone] = serviceStatuses[service?.status] ?? serviceStatuses.unknown;
    return status(label, tone);
}

function servicesShort(report) {
    if (!report) return notice('Отчёт о состоянии сервисов временно недоступен.', true);
    return el('ul', { class: 'service-list' }, Object.entries(serviceNames).map(([key, label]) =>
        el('li', {}, el('strong', {}, label), serviceMarker(report[key]))));
}

function eventList(events) {
    if (!events?.length) return el('p', { class: 'empty' }, 'Действий пока нет.');
    return el('ul', { class: 'event-list' }, events.map(entry => el('li', {},
        el('div', { class: 'stacked-text' }, el('strong', {}, auditLabels[entry.action] ?? entry.action),
            el('small', {}, entry.actor_display_name ?? entry.actor_telegram_id ?? 'Система')), time(entry.created_at))));
}

function panel(title, body, action, description) {
    return el('section', { class: 'panel admin-card' },
        el('header', { class: 'panel-head' }, el('div', {}, el('h2', {}, title),
            description && el('p', { class: 'muted' }, description)), action), body);
}

async function loadOverview(_operator, signal) {
    const stats = await request('/admin/stats', { signal });
    const services = el('div');
    const phase = el('strong', { class: 'command-phase' });
    const phaseHint = el('span', { class: 'muted' });
    const warnings = el('div', { 'aria-live': 'polite' });
    const votes = el('strong', { class: 'command-number' }, numeric(stats.votes));
    const turnout = stats.users ? Math.round(stats.voters / stats.users * 100) : 0;
    function update(report) {
        votes.textContent = numeric(report?.stats?.votes ?? stats.votes);
        const state = report?.phase ?? (stats.voting_open ? 'voting' : 'closed');
        phase.textContent = formatPhase(state);
        phaseHint.textContent = report ? 'Состояние обновляется автоматически' : 'По последним доступным данным';
        services.replaceChildren(servicesShort(report));
        if (!report) {
            warnings.replaceChildren(notice('Нет связи с мониторингом. Состояние сервисов неизвестно.', true));
            return;
        }
        const issues = Object.entries(serviceNames).filter(([key]) => ['down', 'degraded'].includes(report[key]?.status));
        const unknown = Object.keys(serviceNames).some(key => !report[key] || !['ok', 'down', 'degraded'].includes(report[key].status));
        warnings.replaceChildren(issues.length
            ? notice('Требуют внимания: ' + issues.map(([, name]) => name).join(', '), true)
            : unknown ? notice('Состояние некоторых сервисов пока неизвестно.')
                : el('p', { class: 'command-clear' }, 'Сбоев ключевых сервисов не обнаружено'));
    }
    update(currentTelemetry);
    window.addEventListener('admin:telemetry', event => update(event.detail.report), { signal });
    const orbit = el('div', { class: 'command-orbit', 'aria-hidden': 'true' },
        el('span', { class: 'command-orbit__ring' }), el('span', { class: 'command-orbit__core' }, 'ITD'));
    const hero = el('section', { class: 'command-hero' }, orbit,
        el('div', { class: 'command-hero__content' },
            el('p', { class: 'command-eyebrow' }, 'ITD AWARDS / ЦЕНТР УПРАВЛЕНИЯ'),
            el('h1', {}, 'Премия в движении'),
            el('div', { class: 'command-phase-line' }, phase, phaseHint),
            el('div', { class: 'command-actions' }, pageHref('Управлять голосованием', 'voting', 'primary'),
                pageHref('Открыть каталог', 'catalog', 'subtle'))),
        el('div', { class: 'command-hero__metric' }, el('span', {}, 'ВСЕГО ГОЛОСОВ'), votes,
            el('span', {}, numeric(stats.voters) + ' участников проголосовали')));
    return el('section', { class: 'page-stack command-center' }, hero,
        el('div', { class: 'command-metrics' },
            el('div', {}, el('span', {}, 'Участие'), el('strong', {}, turnout + '%'), el('small', {}, 'от всех пользователей')),
            el('div', {}, el('span', {}, 'Пользователи'), el('strong', {}, numeric(stats.users)), el('small', {}, numeric(stats.registered) + ' вошли в аккаунт')),
            el('div', {}, el('span', {}, 'Каталог'), el('strong', {}, numeric(stats.nominations)), el('small', {}, numeric(stats.nominees) + ' номинантов')),
            el('div', {}, el('span', {}, 'Приглашения'), el('strong', {}, numeric(stats.invitations_active)), el('small', {}, 'доступных кодов'))),
        el('div', { class: 'command-grid' },
            el('div', { class: 'page-stack' },
                panel('Динамика участия', activityChart(stats.trends ?? [], signal), null, 'Последние 30 дней · UTC'),
                panel('Последние события', eventList(stats.recent_actions))),
            el('div', { class: 'page-stack' },
                panel('Внимание', warnings, pageHref('Диагностика', 'system', 'subtle compact')),
                panel('Сервисы', services, pageHref('Подробнее', 'system', 'subtle compact')),
                panel('Быстрые действия', el('div', { class: 'command-shortcuts' },
                    pageHref('Пригласить участника', 'invitations', 'subtle'),
                    pageHref('Управление пользователями', 'users', 'subtle'),
                    pageHref('Голоса жюри', 'jury-votes', 'subtle'))))));
}

function settingsForm(settings, owner, signal) {
    const dateField = (label, name) => textField(label, name, dateInput(settings[name]), { type: 'datetime-local' });
    const form = el('form', { class: 'form-stack' },
        toggle('Разрешить голосование', 'voting_open', settings.voting_open),
        el('div', { class: 'form-grid' }, dateField('Начало (местное время)', 'opens_at'), dateField('Окончание (местное время)', 'closes_at')),
        owner ? el('div', { class: 'form-grid' },
            toggle('Разрешить менять выбор', 'allow_vote_changes', settings.allow_vote_changes),
            textField('Вес голоса жюри', 'jury_weight', settings.jury_weight, { type: 'number', min: 1, max: 100, required: true })) : null,
        toggle('Подтверждаю изменение настроек голосования', 'confirm_settings', false),
        formError(), el('div', { class: 'toolbar' }, submit('Сохранить настройки')));
    bindForm(form, async fields => {
        if (!fields.has('confirm_settings')) throw new Error('Подтвердите изменения переключателем.');
        const payload = { confirmed: true };
        for (const key of ['voting_open', 'allow_vote_changes']) {
            if (key === 'allow_vote_changes' && !owner) continue;
            if (fields.has(key) !== settings[key]) payload[key] = fields.has(key);
        }
        for (const key of ['opens_at', 'closes_at']) {
            const value = fields.get(key);
            if (value !== dateInput(settings[key])) payload[key] = value ? new Date(value).toISOString() : null;
        }
        if (owner && Number(fields.get('jury_weight')) !== settings.jury_weight) payload.jury_weight = Number(fields.get('jury_weight'));
        if (Object.keys(payload).length === 1) throw new Error('Настройки не изменились.');
        async function save() {
            await request('/admin/settings', { method:'PATCH',data:payload });
            if (!signal.aborted) showPanel();
            toast('Настройки голосования сохранены.');
        }
        if (settings.voting_open && payload.voting_open === false) {
            confirmAction('Закрыть голосование?', 'Приём новых голосов будет остановлен. Поданные голоса сохранятся.',
                'Закрыть голосование', save);
            return;
        }
        await save();
    });
    return form;
}

function resultTables(rows) {
    const groups = Map.groupBy(rows, row => row.nomination_id);
    if (!groups.size) return el('p', { class: 'empty' }, 'Нет данных по номинантам.');
    return el('div', { class: 'list-detail' }, [...groups.values()].map(group =>
        el('details', {}, el('summary', {}, group[0].title),
            el('div', { class: 'result-comparison' }, compareResults(group),
                table(['Номинант', 'Голоса', 'Жюри', 'Баллы', 'Статус'], group.map(row =>
                    [row.name, numeric(row.vote_count), numeric(row.jury_votes), numeric(row.weighted_score), row.archived ? 'Архив' : 'В каталоге']))))));
}

function compareResults(group) {
    const scored = group.filter(row => !row.archived && row.weighted_score > 0).slice(0, 8);
    if (!scored.length) return null;
    const maximum = Math.max(...scored.map(row => row.weighted_score));
    return el('div', { class: 'bar-list' }, scored.map(row => el('div', { class: 'bar-row' },
        el('div', { class: 'bar-label' }, el('span', {}, row.name), el('strong', {}, numeric(row.weighted_score) + ' баллов')),
        el('progress', { max: maximum, value: row.weighted_score, 'aria-label': 'Баллы · ' + row.name }))));
}

async function loadVoting(operator, signal) {
    const owner = operator.role === 'SUPERADMIN';
    const [settings, stats, results] = await Promise.all([
        request('/admin/settings', { signal }),
        request('/admin/stats', { signal }),
        owner ? request('/admin/results', { signal }) : [],
    ]);
    const publication = settings.results_published;
    const label = publication ? 'Снять с публикации' : 'Опубликовать итоги';
    const changePublication = button(label, () => confirmAction(label,
        publication ? 'Посетители сайта перестанут видеть результаты.' : 'Посетители сайта увидят итоговые баллы по номинантам.',
        label, async () => {
            await request('/admin/settings', { method: 'PATCH', data: { results_published: !publication, confirmed: true } });
            if (!signal.aborted) showPanel();
            toast(publication ? 'Итоги сняты с публикации.' : 'Итоги опубликованы.');
        }), publication ? 'danger' : 'primary', { disabled: !publication && settings.voting_open });
    const voteRows = stats.nomination_votes.map(row => [row.title, rowStatus(row), numeric(row.vote_count)]);
    return el('section', {}, heading('Голосование', 'Расписание, динамика голосования и итоговые результаты.'),
        panel('Динамика голосования', activityChart(stats.trends ?? [], signal), null, 'Последние 30 дней, UTC'),
        panel('Период и правила', settingsForm(settings, owner, signal),
            stats.voting_open ? status('Приём голосов открыт', 'ok') : status('Приём голосов закрыт', 'warn')),
        el('section', { class: 'panel stacked' }, el('div', { class: 'panel-head' }, el('h2', {}, 'Контроль записи бюллетеней')),
            renderVoteHealth(signal)),
        el('section', { class: 'panel stacked' }, el('div', { class: 'panel-head' }, el('h2', {}, 'Хронология премии')),
            votingTimeline(settings, stats)),
        el('section', { class: 'panel stacked' }, el('div', { class: 'panel-head' }, el('h2', {}, 'Статус номинаций'),
            pageHref('Изменить в каталоге', 'catalog', 'subtle compact')),
        table(['Номинация', 'Статус', 'Голоса'], voteRows)),
        owner ? el('section', { class: 'panel stacked' },
            el('div', { class: 'panel-head' }, el('h2', {}, 'Итоговые результаты'),
                el('div', { class: 'toolbar' }, el('a', { class: 'button subtle', href: '/api/admin/results.csv' }, 'Скачать CSV'),
                    el('a', { class: 'button subtle', href: '/api/admin/results', download: 'itd-awards-results.json' }, 'Скачать JSON'),
                    changePublication)),
            !publication && settings.voting_open ? notice('Закройте голосование, чтобы опубликовать итоги.') : null,
            resultTables(results)) : null);
}

function renderVoteHealth(signal) {
    const output = el('div');
    function update(report) {
        output.replaceChildren(definition([
            ['Сохранено после запуска Express', report?.stream?.vote_saves_total],
            ['Отклонено повторных голосований', report?.stream?.duplicate_votes_total],
            ['Последняя проверка', report?.checked_at ? time(report.checked_at) : '—'],
        ]));
    }
    update(currentTelemetry);
    window.addEventListener('admin:telemetry', event => update(event.detail.report), { signal });
    return output;
}

async function loadJuryVotes(_operator, signal) {
    const data = await request('/admin/jury-votes', { signal });
    const nominationChoices = [['', 'Все номинации'], ...data.nominations.map(nomination =>
        [String(nomination.id), nomination.title])];
    const filter = selectField('Номинация', 'nomination_id', nominationChoices);
    const results = el('div', { class: 'page-stack' });
    const view = el('section', { class: 'page-stack' },
        heading('Голоса жюри', 'Анонимные голоса, обоснования и количество выборов по номинациям.'),
        filter, results);

    function render(result) {
        if (!result.nominations.length) {
            results.replaceChildren(notice('Номинаций пока нет.'));
            return;
        }
        results.replaceChildren(...result.nominations.map(nomination => {
            const counts = result.counts.filter(row => row.nomination_id === nomination.id);
            const rows = [
                ...result.votes.filter(row => row.nomination_id === nomination.id).map(row => ({
                    title: row.nominee_name,
                    author: row.author_name || '—',
                    text: row.justification,
                    date: row.updated_at ? time(row.updated_at) : '—',
                })),
                ...result.legacy_reviews.filter(row => row.nomination_id === nomination.id).map(row => ({
                    title: 'Старый отзыв без выбранного номинанта',
                    author: row.author_name || '—',
                    text: row.justification,
                    date: row.created_at ? time(row.created_at) : '—',
                })),
            ];
            const sortedCounts = [...counts].sort((a, b) => Number(b.vote_count) - Number(a.vote_count)
                || String(a.nominee_name).localeCompare(String(b.nominee_name), 'ru'));
            const total = sortedCounts.reduce((sum, row) => sum + Number(row.vote_count || 0), 0);
            const countRows = sortedCounts.length
                ? sortedCounts.map(row => {
                    const count = Number(row.vote_count || 0);
                    const share = total ? Math.round(count / total * 100) : 0;
                    return el('tr', {}, el('td', {}, row.nominee_name),
                        el('td', { class: 'jury-distribution' },
                            el('meter', { min: '0', max: '100', value: String(share),
                                'aria-label': `Доля голосов: ${share}%` }),
                            el('span', {}, share + '%')),
                        el('td', { class: 'jury-number' }, numeric(count)));
                }) : [];
            const distribution = countRows.length
                ? el('div', { class: 'table-frame' }, el('table', {},
                    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Номинант'),
                        el('th', { scope: 'col' }, 'Доля'), el('th', { scope: 'col' }, 'Голосов'))),
                    el('tbody', {}, ...countRows)))
                : el('p', { class: 'muted' }, 'В этой номинации пока нет номинантов.');
            const ballotRows = rows.length
                ? rows.map(row => el('li', { class: 'jury-review' },
                    el('div', { class: 'jury-review__head' }, el('strong', {}, row.title),
                        el('span', { class: 'muted' }, row.date)),
                    el('p', { class: 'muted' }, 'Автор: ' + row.author),
                    el('p', { class: 'jury-review__text' }, row.text)))
                : [el('li', { class: 'muted' }, 'Голосов и старых отзывов пока нет.')];
            return el('section', { class: 'panel jury-votes__nomination' },
                el('div', { class: 'jury-section-head' }, el('h2', {}, nomination.title),
                    el('span', { class: 'muted' }, numeric(total) + ' голосов')),
                distribution,
                el('details', { class: 'jury-reviews' },
                    el('summary', {}, 'Обоснования · ' + numeric(rows.length)),
                    el('ul', { class: 'jury-reviews__list' }, ...ballotRows)));

        }));
    }

    render(data);
    const select = filter.querySelector('select');
    let activeController;
    select?.addEventListener('change', async () => {
        activeController?.abort();
        const controller = new AbortController();
        activeController = controller;
        const onAbort = () => controller.abort();
        signal.addEventListener('abort', onAbort, { once: true });
        results.replaceChildren(notice('Загружаем голоса жюри…'));
        const query = select.value ? '?nomination_id=' + encodeURIComponent(select.value) : '';
        try {
            const next = await request('/admin/jury-votes' + query, { signal: controller.signal });
            if (!controller.signal.aborted) render(next);
        } catch (error) {
            if (!controller.signal.aborted) results.replaceChildren(notice(error.message, true));
        } finally {
            signal.removeEventListener('abort', onAbort);
        }
    }, { signal });
    return view;
}

function votingTimeline(settings, stats) {
    const now = Date.now();
    const phase = settings.results_published ? 'published' : stats.voting_open ? 'voting'
        : settings.voting_open && settings.opens_at && +new Date(settings.opens_at) > now ? 'scheduled' : 'closed';
    return el('ol', { class: 'timeline' }, [
        ['scheduled', 'Начало приёма', settings.opens_at, 'Дата не задана'],
        ['voting', 'Голосование', null, stats.voting_open ? 'Приём открыт' : 'Приём закрыт'],
        ['closed', 'Завершение приёма', settings.closes_at, 'Дата не задана'],
        ['published', 'Публикация итогов', null, settings.results_published ? 'Опубликованы' : 'Скрыты'],
    ].map(([id, label, timestamp, fallback]) => el('li', { 'data-current': String(id === phase) },
        el('strong', {}, label), timestamp ? time(timestamp) : el('div', {}, fallback))));
}

function uptime(seconds) {
    if (seconds == null) return '—';
    const minutes = Math.max(0, Math.floor(seconds / 60));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor(minutes / 60) % 24;
    return (days ? days + ' д ' : '') + (hours ? hours + ' ч ' : '') + (minutes % 60) + ' мин';
}

async function loadSystem(_operator, signal) {
    const report = currentTelemetry ?? await request('/admin/nexus/telemetry', { signal });
    const check = el('div');
    const services = el('div');
    const errors = el('div');
    function update(next) {
        if (!next) {
            check.replaceChildren(notice('Связь с API прервана. Следующая проверка выполнится автоматически.', true));
            services.replaceChildren();
            errors.replaceChildren();
            return;
        }
        check.replaceChildren(definition([['Время', time(next.checked_at)], ['Версия API', next.version],
            ['Запросов за время работы', next.stream?.requests_total], ['Ошибок за время работы', next.stream?.errors_total]]));
        const names = { ...serviceNames, auth: 'Авторизация', voting: 'Голосование', media: 'Хранилище' };
        services.replaceChildren(table(['Сервис', 'Состояние', 'Время работы', 'Отклик', 'Последний сигнал'],
            Object.entries(names).filter(([key]) => next[key]).map(([key, label]) => {
                const service = next[key];
                const latency = service.latency_ms ?? service.response_ms;
                return [label, serviceMarker(service), uptime(service.uptime_seconds), latency == null ? '—' : latency + ' мс',
                    service.last_seen_at ? time(service.last_seen_at) : '—'];
            })));
        errors.replaceChildren(table(['Сервис', 'Код', 'Время'], next.recent_errors.map(entry =>
            [names[entry.service] ?? entry.service, el('code', {}, entry.code), time(entry.at)]), 'За время работы ошибок не зарегистрировано.'));
    }
    update(report);
    window.addEventListener('admin:telemetry', ({ detail }) => update(detail.report), { signal });
    return el('section', { class: 'page-stack' }, heading('Состояние сервисов', 'Доступность, нагрузка и ошибки приложения'),
        panel('Сводка',check),
        panel('Компоненты', services), panel('Последние ошибки', errors));
}

function formatPhase(phase) {
    return {
        voting: 'Голосование открыто',
        scheduled: 'Ожидает открытия',
        published: 'Итоги опубликованы',
        results: 'Итоги опубликованы',
        closed: 'Голосование закрыто',
        preparation: 'Подготовка',
        counting: 'Подсчёт',
    }[phase] ?? 'Этап неизвестен';
}

function updateSystemBar(report) {
    const values = [['API', report?.backend?.status], ['БД', report?.postgresql?.status], ['Telegram', report?.telegram?.status]];
    document.getElementById('header-status').replaceChildren(...values.map(([name, state]) => {
        const [label, tone] = serviceStatuses[state] ?? serviceStatuses.unknown;
        return el('span', { class: 'status ' + tone, title: name + ' · ' + label, 'aria-label': name + ' · ' + label }, name);
    }), status(report ? formatPhase(report.phase) : 'Этап неизвестен', report?.phase === 'voting' ? 'ok' : 'warn'));
}

function startTelemetry() {
    if (telemetryStarted) return;
    telemetryStarted = true;
    let inFlight = false;
    async function poll() {
        if (inFlight || document.hidden || runtime.signal.aborted) return;
        inFlight = true;
        try {
            currentTelemetry = await request('/admin/nexus/telemetry', { signal: runtime.signal });
        } catch (error) {
            if (error.status === 401) fail(error);
            currentTelemetry = null;
        } finally {
            inFlight = false;
        }
        if (runtime.signal.aborted) return;
        updateSystemBar(currentTelemetry);
        window.dispatchEvent(new CustomEvent('admin:telemetry', { detail: { report: currentTelemetry } }));
    }
    const interval = setInterval(poll, 10_000);
    runtime.signal.addEventListener('abort', () => clearInterval(interval), { once: true });
    document.addEventListener('visibilitychange', poll, { signal: runtime.signal });
    poll();
}

function fail(error) {
    if (error.status === 401) {
        location.replace('/sign-in?return_to=%2Fadmin');
        return;
    }
    view.replaceChildren(heading('Админ-панель'), notice(error.message, true),
        button('Повторить', () => viewer ? showPanel() : init(), 'subtle'));
}

async function showPanel() {
    pending?.abort();
    const controller = new AbortController();
    const { signal } = controller;
    pending = controller;
    const hash = location.hash.slice(1);
    const id = { audit: 'security', lab: 'overview', constellation: 'catalog' }[hash] ?? hash;
    const [section, title, load] = visible.find(item => item[0] === id) ?? visible[0];
    document.getElementById('section-name').textContent = title;
    document.title = title + ' · ITD Awards';
    for (const link of navigation.querySelectorAll('a')) {
        if (link.hash === '#' + section) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    }
    view.setAttribute('aria-busy', 'true');
    const slow = setTimeout(() => {
        if (!signal.aborted) view.replaceChildren(el('p', { class: 'empty', role: 'status' }, 'Загрузка раздела…'));
    }, 180);
    try {
        const content = await load(viewer, signal);
        if (signal.aborted) return;
        view.replaceChildren(content);
    } catch (error) {
        if (!signal.aborted) fail(error);
    } finally {
        clearTimeout(slow);
        if (!signal.aborted) view.removeAttribute('aria-busy');
    }
}

async function init() {
    try {
        const auth = await request('/auth/me');
        if (!auth.user) return fail({ status: 401 });
        if (!['MANAGER', 'SUPERADMIN'].includes(auth.user.role)) return fail(new Error('Доступ к панели ограничен.'));
        viewer = auth.user;
        visible = panels.filter(item => !item[4] || item[4] === viewer.role);
        const name = viewer.displayName || roles[viewer.role];
        document.getElementById('operator-name').textContent = name;
        document.getElementById('operator-mark').textContent = name.slice(0, 2).toUpperCase();
        document.getElementById('operator-role').textContent = roles[viewer.role];
        navigation.replaceChildren(...visible.map(([id, label, , icon]) =>
            el('a', { href: '#' + id, class: 'nav-link' },
                el('span', { 'aria-hidden': 'true', class: 'nav-icon' }, icon), label)));
        startTelemetry();
        await showPanel();
    } catch (error) {
        fail(error);
    }
}

const commandDialog = document.getElementById('command-dialog');
const commandOpen = document.getElementById('command-open');
function openCommands() {
    if (!viewer || commandDialog.open || document.getElementById('dialog').open) return;
    const input = el('input', { type: 'search', class: 'command-search', placeholder: 'Название раздела', 'aria-label': 'Поиск раздела', autocomplete: 'off' });
    const list = el('div', { class: 'command-list', 'aria-live': 'polite' });
    const render = () => {
        const query = input.value.trim().toLocaleLowerCase('ru');
        const matches = visible.filter(([, title]) => title.toLocaleLowerCase('ru').includes(query));
        list.replaceChildren(...(matches.length ? matches.map(([id, title, , icon]) =>
            button([el('span', { class: 'command-item-icon', 'aria-hidden': 'true' }, icon),
                el('span', {}, title), el('span', { class: 'command-item-key', 'aria-hidden': 'true' }, '↵')], () => {
                commandDialog.close(); location.hash = id;
            }, 'command-item')) : [el('p', { class: 'empty' }, 'Раздел не найден')]));
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); commandDialog.close(); return; }
        if (event.key === 'ArrowDown') { event.preventDefault(); list.querySelector('button')?.focus(); }
        if (event.key === 'Enter') { event.preventDefault(); list.querySelector('button')?.click(); }
    });
    list.addEventListener('keydown', event => {
        const items = [...list.querySelectorAll('button')];
        const index = items.indexOf(document.activeElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (event.key === 'ArrowUp' && index === 0) input.focus();
            else items[Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
        }
    });
    commandDialog.replaceChildren(el('div', { class: 'command-dialog__head' },
        el('div', {}, el('p', { class: 'command-eyebrow' }, 'ITD AWARDS / НАВИГАЦИЯ'), el('h2', { id: 'command-title' }, 'Перейти к разделу')),
        button('×', () => commandDialog.close(), 'subtle icon-only', { 'aria-label': 'Закрыть' })), input, list,
        el('p', { class: 'command-help' }, '↑ ↓ выбор   ·   Enter открыть   ·   Esc закрыть'));
    render(); commandDialog.showModal(); input.focus();
}
commandOpen.addEventListener('click', openCommands);
document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (commandDialog.open) commandDialog.close(); else openCommands();
    }
});

const effectsToggle = document.getElementById('effects-toggle');
let effectsEnabled = true;
try { effectsEnabled = localStorage.getItem('admin-effects') !== 'off'; } catch { /* Storage is optional. */ }
function updateEffects() {
    document.body.classList.toggle('effects-off', !effectsEnabled);
    effectsToggle.setAttribute('aria-pressed', String(effectsEnabled));
    effectsToggle.textContent = effectsEnabled ? 'Эффекты: вкл.' : 'Эффекты: выкл.';
}
effectsToggle.addEventListener('click', () => {
    effectsEnabled = !effectsEnabled;
    try { localStorage.setItem('admin-effects', effectsEnabled ? 'on' : 'off'); } catch { /* Storage is optional. */ }
    updateEffects();
});
updateEffects();
document.addEventListener('visibilitychange', () => document.body.classList.toggle('motion-paused', document.hidden));

window.addEventListener('hashchange', () => { if (viewer) showPanel(); });
document.getElementById('refresh-panel').addEventListener('click',() => { if (viewer) showPanel(); });
window.addEventListener('pagehide', event => { if (!event.persisted) { runtime.abort(); pending?.abort(); } });
document.querySelector('.skip').addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('workspace').focus();
});
document.getElementById('logout').addEventListener('click', async () => {
    try { await request('/auth/logout', { method: 'POST', data: {} }); location.replace('/'); }
    catch (error) { toast(error.message, true); }
});
init();
