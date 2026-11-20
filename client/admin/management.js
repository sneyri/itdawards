import { button, confirmAction, date, definition, el, formError, heading, notice, numbers, request,
    roles, selectField, showDialog, status, submit, table, textField, toast } from './ui.js';

const methods = { telegram: 'Telegram', password: 'Пароль', recovery: 'Восстановление',
    invitation: 'Приглашение', unknown: 'Не записан', legacy: 'Существующая сессия' };
const auditNames = {
    'user.updated': 'Изменены права пользователя', 'settings.updated': 'Изменены настройки премии',
    'account.recovered': 'Восстановлен доступ', 'invitation.created': 'Создано приглашение',
    'invitation.bulk_created': 'Создан пакет приглашений', 'invitation.redeemed': 'Активировано приглашение',
    'invitation.reissued': 'Повторно выдан код входа',
    'invitation.revoked': 'Отозвано приглашение', 'session.revoked': 'Завершена сессия',
    'auth.failure': 'Неудачная попытка входа', 'auth.rate_limited': 'Ограничено число попыток входа',
    'audit.official_catalog_imported': 'Импортирован официальный каталог',
};
const columnNames = {
    id: 'ID', title: 'Название', name: 'Имя', description: 'Описание', status: 'Статус',
    role: 'Роль', sort_order: 'Порядок', archived: 'В архиве', created_at: 'Дата создания',
    nomination_id: 'ID номинации', link_url: 'Ссылка', image_url: 'Изображение', expires_at: 'Действует до',
    max_uses: 'Лимит использований', use_count: 'Использовано', revoked_at: 'Дата отзыва',
    voting_open: 'Голосование открыто', opens_at: 'Начало', closes_at: 'Завершение',
    allow_vote_changes: 'Можно менять голос', jury_weight: 'Вес жюри', results_published: 'Итоги опубликованы',
    action: 'Действие', target_type: 'Тип объекта',
};
const serviceNames = {
    backend: 'Express', postgresql: 'PostgreSQL', telegram: 'Telegram-бот', auth: 'Авторизация',
};
const formattedRole = role => roles[role] ?? role ?? '—';
const count = number => number == null ? '—' : numbers.format(number);
const timestamp = value => value ? el('time', { datetime: value }, date(value)) : '—';
const method = value => methods[value] ?? value ?? 'Не записан';
const code = value => el('code', { class: 'mono' }, value ?? '—');
const searchKey = value => (value ?? '').trim().toLowerCase();
function pathWithQuery(path, options) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) {
        if (value != null && value !== '') query.set(key, value);
    }
    return query.size ? path + '?' + query : path;
}

function auditDetails(entry) {
    const secretKeys = /password|secret|token|hash|authorization|cookie|recovery.?key|code.?value/i;
    const details = JSON.stringify(entry.details ?? {}, (key, value) => secretKeys.test(key) ? undefined : value, 2);
    return el('details', { class: 'admin-entry-details' }, el('summary', {}, 'Детали'),
        el('pre', {}, details === '{}' ? 'Подробности отсутствуют.' : details));
}

function auditTable(entries) {
    return table(['Время', 'Событие', 'Инициатор', 'Объект', ''], entries.map(entry => [
        timestamp(entry.created_at), auditNames[entry.action] ?? entry.action, entry.actor_display_name || entry.actor_telegram_id || 'Система',
        code([entry.target_type, entry.target_id].filter(Boolean).join(' · ')), auditDetails(entry),
    ]), 'Подходящих событий нет.');
}

function columnLabel(name) {
    return columnNames[name] ?? name;
}

function cellValue(value, column) {
    if (value == null) return '—';
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    if (typeof value === 'number') return count(value);
    if (column.name === 'role') return formattedRole(value);
    if (typeof value === 'string' && /date|time/i.test(column.type ?? '') && /^\d{4}-\d{2}-\d{2}/.test(value)) return timestamp(value);
    if (column.name === 'id' || column.name.endsWith('_id')) return code(value);
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function paging(offset, size, total, changePage) {
    const knownTotal = Number(total);
    const page = Math.floor(offset / size) + 1;
    const pages = Math.max(1, Math.ceil(knownTotal / size));
    return el('div', { class: 'admin-pages' },
        el('span', { class: 'admin-tool-meta' }, knownTotal ? numbers.format(offset + 1) + '–'
            + numbers.format(Math.min(knownTotal, offset + size)) + ' из ' + count(knownTotal) : '0 записей'),
        el('div', { class: 'toolbar' },
            button('Назад', () => changePage(Math.max(0, offset - size)), 'subtle compact', { disabled: page <= 1 }),
            button('Далее', () => changePage(offset + size), 'subtle compact', { disabled: page >= pages })));
}

function afterAction(action) {
    return async event => {
        const target = event.currentTarget;
        target.disabled = true;
        try { await action(); }
        catch (error) { toast(error.message, true); }
        finally { target.disabled = false; }
    };
}

export async function loadDatabase(_viewer, signal) {
    const tables = await request('/admin/nexus/tables', { signal });
    const content = el('section', { class: 'admin-tool-stack' });
    const quickLinks = el('nav', { class: 'admin-db-tables', 'aria-label': 'Наборы данных' });
    const details = el('div', { class: 'admin-tool-stack' });
    const offline = formError();
    let queryAbort;
    let selected = tables[0];
    let filters = { search: '', sort: '', direction: 'asc', offset: 0, limit: 30 };
    signal.addEventListener('abort', () => queryAbort?.abort(), { once: true });

    function tablePath() {
        return '/admin/nexus/tables/' + encodeURIComponent(selected.id);
    }

    function drawTables() {
        quickLinks.replaceChildren(...tables.map(entry => button(
            el('span', { class: 'admin-db-table-label' }, el('span', {}, entry.label || entry.id),
                code(count(entry.count))),
            () => {
                selected = entry;
                filters = { search: '', sort: '', direction: 'asc', offset: 0, limit: 30 };
                drawTables();
                loadRows();
            }, 'subtle', { 'aria-current': selected.id === entry.id ? 'true' : null })));
    }

    function renderRows(result) {
        const current = result.table ?? selected;
        const rowData = result.rows ?? [];
        const columns = current.columns ?? [];
        const find = textField('Поиск по строкам', 'search', filters.search, {
            type: 'search', maxlength: 120, placeholder: 'Значение поля',
        });
        const sortChoices = [['', 'По умолчанию'], ...columns.map(column => [column.name, columnLabel(column.name)])];
        const fieldChoices = [['', 'Все поля'], ...sortChoices.slice(1)];
        const form = el('form', { class: 'filters admin-query-bar' }, find,
            selectField('Поле фильтра', 'column', fieldChoices, filters.column),
            textField('Точное значение', 'value', filters.value, { maxlength: 120 }),
            selectField('Сортировать', 'sort', sortChoices, filters.sort),
            selectField('Порядок', 'direction', [['asc', 'По возрастанию'], ['desc', 'По убыванию']], filters.direction),
            submit('Применить'));
        form.addEventListener('submit', event => {
            event.preventDefault();
            const data = new FormData(form);
            const column = data.get('column');
            const value = data.get('value').trim();
            if (column && !value) {
                offline.textContent = 'Укажите точное значение выбранного поля.';
                return;
            }
            filters = { ...filters, search: data.get('search').trim(), sort: data.get('sort'), direction: data.get('direction'),
                column, value: column ? value : '', offset: 0 };
            loadRows();
        });
        const exportPath = '/api' + pathWithQuery(tablePath(), { search: filters.search, sort: filters.sort,
            direction: filters.direction, column: filters.column, value: filters.value, format: 'csv' });
        const knownEditors = ['/admin#catalog', '/admin#users', '/admin#invitations', '/admin#voting'];
        const editor = knownEditors.includes(current.edit_path) ? el('a', { class: 'button subtle', href: current.edit_path }, 'Открыть в редакторе') : null;
        const schema = el('details', { class: 'admin-entry-details admin-db-columns' }, el('summary', {}, 'Структура · ' + columns.length + ' полей'),
            el('dl', { class: 'definition' }, columns.map(column => [
                el('dt', {}, code(column.name)), el('dd', {}, column.type || '—'),
            ])));
        details.replaceChildren(el('header', { class: 'admin-db-header' },
            el('div', {}, el('h2', {}, current.label || current.id), el('p', { class: 'admin-tool-meta' }, current.id)),
            el('div', { class: 'toolbar' }, editor, el('a', { class: 'button subtle', href: exportPath }, 'CSV выборки'))),
        schema, form, table(columns.map(column => columnLabel(column.name)), rowData.map(row =>
            columns.map(column => cellValue(row[column.name], column))), 'Строки не найдены.'),
        paging(result.offset, result.limit, result.total, offset => { filters = { ...filters, offset }; loadRows(); }));
    }

    async function loadRows() {
        queryAbort?.abort();
        const controller = new AbortController();
        queryAbort = controller;
        details.setAttribute('aria-busy', 'true');
        offline.textContent = '';
        try {
            const rows = await request(pathWithQuery(tablePath(), filters), { signal: controller.signal });
            if (!controller.signal.aborted) renderRows(rows);
        } catch (error) {
            if (!controller.signal.aborted) offline.textContent = error.message;
        } finally {
            if (!controller.signal.aborted) details.removeAttribute('aria-busy');
        }
    }

    if (!selected) return el('section', {}, heading('База данных', 'Разрешённые наборы PostgreSQL.'), notice('Доступных таблиц нет.'));
    content.append(heading('База данных', 'Структура, строки и экспорт разрешённых наборов PostgreSQL.'), offline,
        el('div', { class: 'admin-db-layout' }, quickLinks, details));
    drawTables();
    await loadRows();
    return content;
}

function revokeSession(userId, session, onDone, signal) {
    return confirmAction('Завершить сессию?', 'Устройство потеряет доступ и должно будет войти заново.', 'Завершить сессию',
        async () => {
            await request('/admin/nexus/users/' + encodeURIComponent(userId) + '/sessions/' + encodeURIComponent(session.id),
                { method: 'DELETE', data: { confirmed: true }, signal });
            if (!signal.aborted) {
                toast('Сессия завершена.');
                await onDone();
            }
        });
}

function userSessionTable(sessions, onDone, signal, user) {
    return table([user ? 'Способ входа' : 'Аккаунт', 'Начало', 'Истекает', 'Действие'], sessions.map(session => [
        user ? method(session.method) : el('div', { class: 'stacked-text' }, session.display_name || session.user_id,
            el('small', {}, formattedRole(session.role), ' · ', method(session.method))),
        timestamp(session.created_at), timestamp(session.expires_at),
        session.current ? status('Текущая', 'ok') : button('Завершить', () => revokeSession(user?.id ?? session.user_id, session, onDone, signal),
            'danger compact', { 'aria-label': 'Завершить сессию от ' + date(session.created_at) }),
    ]), 'Активных сессий нет.');
}

export function showUserSessions(profileUser, signal, back) {
    const content = el('div', { class: 'admin-tool-stack' }, notice('Загружаем сессии…'));
    const id = profileUser.id;
    let dialog;
    async function load() {
        try {
            const report = await request('/admin/nexus/users/' + encodeURIComponent(id) + '/sessions', { signal });
            if (signal.aborted || !dialog.open || !content.isConnected) return;
            content.replaceChildren(definition([
                ['Способ регистрации', method(report.user.registration_method)], ['Последний вход', timestamp(report.user.last_login_at)],
                ['Активность на сайте', timestamp(report.user.last_activity_at)],
            ]), el('h3', {}, 'Активные сессии'), userSessionTable(report.sessions, open, signal, report.user),
            el('h3', {}, 'История входов'), report.logins.length ? el('ol', { class: 'admin-timeline' }, report.logins.map(login =>
                el('li', {}, el('strong', {}, method(login.method)), timestamp(login.at)))) : notice('История входов ещё не накопилась.'),
            back && button('К профилю', back, 'subtle'));
        } catch (error) {
            if (!signal.aborted) content.replaceChildren(notice(error.message, true), back && button('К профилю', back, 'subtle'));
        }
    }

    function open() {
        dialog = showDialog(profileUser.display_name || 'Сессии пользователя', content);
        return load();
    }
    return open();
}

function groupErrors(errors) {
    const groups = new Map();
    for (const error of errors) {
        const key = error.service + '\n' + error.code;
        const previous = groups.get(key);
        if (!previous) groups.set(key, { ...error, occurrences: 1 });
        else {
            previous.occurrences += 1;
            if (error.at > previous.at) previous.at = error.at;
        }
    }
    return [...groups.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

function errorTable(errors) {
    return table(['Последняя отметка', 'Сервис', 'Код', 'Повторы'], groupErrors(errors).map(entry => [
        timestamp(entry.at), serviceNames[entry.service] ?? entry.service, code(entry.code), count(entry.occurrences),
    ]), 'Системных ошибок в доступном окне нет.');
}

function toIso(value) {
    return value ? new Date(value).toISOString() : '';
}

export async function loadSecurity(_viewer, signal) {
    let report = await request('/admin/nexus/security', { signal });
    const box = el('div', { class: 'admin-tool-stack' });
    const message = formError();
    const controls = el('div', { class: 'toolbar admin-security-tabs', 'aria-label': 'Инструменты безопасности' });
    let section = 'overview';
    let loadAbort;
    let logTimer;
    let visitedOverview = false;
    const titles = { overview: 'Безопасность', sessions: 'Сессии', audit: 'Журнал действий', errors: 'Ошибки сервиса' };
    function stop() {
        loadAbort?.abort();
        clearTimeout(logTimer);
    }
    signal.addEventListener('abort', stop, { once: true });

    function open(next) {
        if (signal.aborted) return;
        stop();
        box.removeAttribute('aria-busy');
        section = next;
        message.textContent = '';
        loadAbort = new AbortController();
        controls.replaceChildren(...Object.entries(titles).map(([name, label]) =>
            button(label, () => open(name), 'subtle', { 'aria-pressed': String(section === name) })));
        if (next === 'overview') showOverview(loadAbort.signal);
        else if (next === 'sessions') showSessions(loadAbort.signal);
        else if (next === 'audit') showLog(loadAbort.signal, false);
        else showLog(loadAbort.signal, true);
    }

    async function showOverview(ownSignal) {
        function draw() {
            box.replaceChildren(
                el('dl', { class: 'admin-security-stats' }, [
                    ['Активные сессии', report.active_sessions], ['Заблокированные аккаунты', report.blocked_users],
                    ['Неудачные попытки за ' + count(report.attempt_period_hours) + ' ч', report.failed_attempts],
                ].map(([key, value]) => el('div', {}, el('dt', {}, key), el('dd', {}, count(value))))),
                report.attempt_tracking_since && el('p', { class: 'admin-tool-meta' }, 'Начало учёта попыток ', timestamp(report.attempt_tracking_since)),
                el('h2', {}, 'Недавние события безопасности'), auditTable(report.recent ?? []));
        }
        draw();
        if (!visitedOverview) {
            visitedOverview = true;
            return;
        }
        try {
            const current = await request('/admin/nexus/security', { signal: ownSignal });
            if (!ownSignal.aborted) { report = current; draw(); }
        } catch (error) {
            if (!ownSignal.aborted) message.textContent = error.message;
        }
    }

    async function showSessions(ownSignal, offset = 0) {
        box.setAttribute('aria-busy', 'true');
        try {
            const data = await request(pathWithQuery('/admin/nexus/sessions', { limit: 30, offset }), { signal: ownSignal });
            if (ownSignal.aborted) return;
            const reload = () => showSessions(ownSignal, data.sessions.length <= 1 ? Math.max(0, offset - 30) : offset);
            box.replaceChildren(el('div', { class: 'admin-db-header' }, el('h2', {}, 'Активные сессии'),
                button('Обновить', afterAction(() => showSessions(ownSignal, offset)), 'subtle')),
            userSessionTable(data.sessions, reload, ownSignal), paging(data.offset, data.limit, data.total,
                position => showSessions(ownSignal, position)));
        } catch (error) {
            if (!ownSignal.aborted) message.textContent = error.message;
        } finally {
            if (!ownSignal.aborted) box.removeAttribute('aria-busy');
        }
    }

    function showLog(ownSignal, errors) {
        const result = el('div', { class: 'admin-tool-stack' });
        const pager = el('nav', { class: 'toolbar', 'aria-label': 'Страницы журнала' });
        const search = textField('Поиск', 'search', '', { type: 'search', maxlength: 120, placeholder: errors ? 'Сервис или код' : 'Событие, пользователь, объект' });
        const form = el('form', { class: 'filters admin-query-bar' }, search,
            textField('С', 'from', '', { type: 'datetime-local' }), textField('По', 'to', '', { type: 'datetime-local' }),
            !errors && selectField('Уровень', 'level', [['', 'Все'], ['info', 'Действия'], ['warning', 'Предупреждения']]),
            submit('Применить'));
        const live = el('p', { class: 'admin-tool-meta', 'aria-live': 'polite' });
        const tools = el('div', { class: 'toolbar' });
        let paused = false;
        let filters = {};
        let position;
        let saved = [];
        let version = 0;
        const pauseButton = button('Пауза', () => {
            paused = !paused;
            pauseButton.textContent = paused ? 'Возобновить' : 'Пауза';
            pauseButton.setAttribute('aria-pressed', String(paused));
            live.textContent = paused ? 'Поток на паузе.' : 'Обновление включено.';
            if (!paused) {
                position = undefined;
                load();
            }
        }, 'subtle', { 'aria-pressed': 'false' });
        const exportLink = errors ? null : el('a', { class: 'button subtle', href: '/api/admin/audit?format=csv' }, 'CSV выборки');
        tools.append(pauseButton, button('Обновить', afterAction(() => load()), 'subtle'));
        if (exportLink) tools.append(exportLink);
        else tools.append(button('JSON выборки', () => downloadJson('itd-system-errors.json', groupErrors(saved)), 'subtle'));

        async function load() {
            const generation = ++version;
            const path = errors ? '/admin/system' : pathWithQuery('/admin/audit', { ...filters, before: position });
            box.setAttribute('aria-busy', 'true');
            try {
                const response = await request(path, { signal: ownSignal });
                if (ownSignal.aborted || generation !== version) return;
                message.textContent = '';
                if (errors) {
                    const term = searchKey(filters.search);
                    saved = response.recent_errors.filter(entry => (!term || searchKey(entry.service + ' ' + entry.code).includes(term))
                        && (!filters.from || entry.at >= filters.from) && (!filters.to || entry.at <= filters.to));
                    result.replaceChildren(errorTable(saved));
                } else {
                    result.replaceChildren(auditTable(response.entries));
                    pager.replaceChildren(
                        position && button('К новым', () => { position = undefined; load(); }, 'subtle compact'),
                        response.next && button('К более ранним', () => { position = response.next; load(); }, 'subtle compact'));
                }
                live.textContent = paused ? 'Поток на паузе.' : position ? 'Показана предыдущая часть журнала.'
                    : 'Обновляется каждые 12 с · ' + new Intl.DateTimeFormat('ru-RU', { timeStyle: 'medium' }).format();
            } catch (error) {
                if (!ownSignal.aborted && generation === version) message.textContent = error.message;
            } finally {
                if (!ownSignal.aborted && generation === version) box.removeAttribute('aria-busy');
            }
        }

        function schedule() {
            logTimer = setTimeout(async () => {
                if (ownSignal.aborted) return;
                if (!paused && !position && !document.hidden && !result.querySelector('details[open]')) await load();
                if (!ownSignal.aborted) schedule();
            }, 12_000);
        }

        form.addEventListener('submit', event => {
            event.preventDefault();
            const fields = new FormData(form);
            filters = { search: fields.get('search').trim(), level: fields.get('level') ?? '',
                from: toIso(fields.get('from')), to: toIso(fields.get('to')) };
            if (filters.from && filters.to && filters.from > filters.to) {
                message.textContent = 'Начало периода должно быть раньше окончания.';
                return;
            }
            position = undefined;
            if (exportLink) exportLink.href = '/api' + pathWithQuery('/admin/audit', { ...filters, format: 'csv' });
            load();
        });
        box.replaceChildren(el('div', { class: 'admin-db-header' }, el('h2', {}, errors ? 'Ошибки сервисов' : 'Журнал действий'), tools),
            form, live, result, pager);
        load();
        schedule();
    }

    open('overview');
    return el('section', { class: 'admin-tool-stack' }, heading('Безопасность', 'Сессии, история входов и операции администрирования.'),
        controls, message, box);
}

function downloadJson(filename, data) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = el('a', { href: url, download: filename });
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
