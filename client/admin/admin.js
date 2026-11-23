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
    const phase = el('div');
    const votes = el('strong', { class: 'stat-value' });
    const voterPercent = stats.users ? Math.round(stats.voters / stats.users * 100) : 0;
    function update(report) {
        votes.textContent = numeric(report?.stats?.votes ?? stats.votes);
        services.replaceChildren(servicesShort(report));
        const state = report?.phase ?? (stats.voting_open ? 'voting' : 'closed');
        phase.replaceChildren(status(formatPhase(state), state === 'voting' ? 'ok' : 'warn'));
    }
    update(currentTelemetry);
    window.addEventListener('admin:telemetry', event => update(event.detail.report), { signal });
    return el('section', { class: 'page-stack' },
        heading('Обзор', 'Каталог, участники и голосование', pageHref('Управлять голосованием', 'voting', 'primary')),
        el('div', { class: 'stat-grid' },
            statCard({ label: 'Пользователи', value: stats.users, icon: '◎', note: 'Вошли в аккаунт: ' + stats.registered }),
            statCard({ label: 'Голоса', value: votes, icon: '◆', note: 'Баллов с весом: ' + stats.weighted_score }),
            statCard({ label: 'Проголосовали', value: stats.voters, icon: '✓', note: voterPercent + '% от всех пользователей' }),
            statCard({ label: 'Номинации', value: stats.nominations, icon: '◫', note: 'Номинантов: ' + stats.nominees }),
            statCard({ label: 'Жюри', value: stats.jurors, icon: '✦', note: 'Администраторов: ' + stats.administrators }),
            statCard({ label: 'Активные коды', value: stats.invitations_active, icon: '⌁', note: 'Доступных приглашений' })),
        el('div', { class: 'dashboard-grid' },
            el('div', { class: 'page-stack' },
                panel('Голосование', phase, pageHref('Настройки', 'voting', 'subtle compact')),
                panel('Сервисы', services, pageHref('Подробнее', 'system', 'subtle compact'))),
            panel('Последние действия', eventList(stats.recent_actions))));
}

function statCard({ label, value, note, icon }) {
    const display = value instanceof Node ? value : el('strong', { class: 'stat-value' });
    if (!(value instanceof Node)) display.textContent = numeric(value);
    return el('article', { class: 'panel stat-card' },
        el('div', { class: 'stat-card__head' },
            el('h2', {}, label),
            el('span', { class: 'stat-card__icon', 'aria-hidden': 'true' }, icon)),
        display,
        note ? el('p', { class: 'stat-card__note' }, note) : null);
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
            const ballots = result.votes.filter(row => row.nomination_id === nomination.id)
                .map(row => [row.nominee_name, row.author_name || '—', row.justification,
                    row.updated_at ? time(row.updated_at) : '—']);
            const legacy = result.legacy_reviews.filter(row => row.nomination_id === nomination.id)
                .map(row => ['Старый отзыв (без выбранного номинанта)', row.author_name || '—', row.justification,
                    row.created_at ? time(row.created_at) : '—']);
            return el('section', { class: 'panel jury-votes__nomination' },
                el('h2', {}, nomination.title),
                el('h3', {}, 'Количество голосов за номинантов'),
                table(['Номинант', 'Голосов'], counts.map(row => [row.nominee_name, numeric(row.vote_count)]),
                    'В этой номинации пока нет номинантов.'),
                el('h3', {}, 'Голоса и обоснования'),
                table(['Номинант', 'Автор', 'Обоснование выбора', 'Дата изменения / отправки'], [...ballots, ...legacy],
                    'Голосов и старых отзывов пока нет.'));
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
