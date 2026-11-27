import {
    bindForm, button, clipboardButton, confirmAction, date, definition, el, formError,
    heading, notice, numbers, request, roles, selectField, showDialog, status, submit, table, textField, toast, toggle,
} from './ui.js';
import { showUserSessions } from './management.js';
import { readPanelUrl, updatePanelUrl } from './panel-url.js';

const participantRoles = Object.entries(roles).filter(([role]) => role === 'USER' || role === 'JURY');
const accountSort = [
    ['created_desc', 'Сначала новые'], ['created_asc', 'Сначала ранние'], ['name_asc', 'По имени'],
    ['last_login_desc', 'По последнему входу'], ['role_asc', 'По роли'],
];
const invitationStatus = {
    active: ['Активно', 'ok'], used: ['Использовано', 'warn'],
    expired: ['Истекло', 'warn'], revoked: ['Отозвано', 'bad'],
};
const actionLabels = {
    'user.updated': 'Изменение доступа', 'account.recovered': 'Восстановление аккаунта',
    'invitation.redeemed': 'Регистрация по приглашению', 'invitation.created': 'Создание приглашения',
    'invitation.reissued': 'Повторная выдача кода', 'invitation.revoked': 'Отзыв приглашения', 'nomination.created': 'Создание номинации',
    'nomination.updated': 'Изменение номинации', 'nomination.deleted': 'Удаление номинации',
    'nominee.created': 'Добавление номинанта', 'nominee.updated': 'Изменение номинанта',
    'nominee.deleted': 'Удаление номинанта', 'settings.updated': 'Настройки голосования',
};

function optionParam(params, name, choices, fallback = '') {
    const value = params.get(name);
    return choices.some(([key]) => key === value) ? value : fallback;
}

function pageParam(params, maximum) {
    const value = params.get('page');
    return /^[1-9]\d{0,7}$/.test(value ?? '') && Number(value) <= maximum ? Number(value) : 1;
}

function taggedRole(role) {
    return el('span', { class: 'tag' }, roles[role] || role);
}

function accountStatus(blocked) {
    return status(blocked ? 'Заблокирован' : 'Активен', blocked ? 'bad' : 'ok');
}

function accountName(user) {
    return user.display_name || user.username || 'Пользователь';
}

function pager(page, hasNext, changePage) {
    if (page === 1 && !hasNext) return null;
    return el('nav', { class: 'pager', 'aria-label': 'Страницы таблицы' },
        button('Назад', () => changePage(page - 1), 'subtle compact', { disabled: page === 1 }),
        el('span', { class: 'stamp', 'aria-live': 'polite' }, 'Страница ' + numbers.format(page)),
        button('Дальше', () => changePage(page + 1), 'subtle compact', { disabled: !hasNext }));
}

async function viewDialog(title, signal, content) {
    const body = el('div', { class: 'form-stack' }, notice('Загрузка…'));
    const dialog = showDialog(title, body);
    try {
        const view = await content();
        if (dialog.open && body.isConnected && !signal.aborted) body.replaceChildren(view);
    } catch (error) {
        if (dialog.open && body.isConnected && !signal.aborted) body.replaceChildren(notice(error.message, true));
    }
}

function historyChange(entry) {
    const details = entry.details ?? {};
    const changes = [];
    if (details.role?.after) changes.push(roles[details.role.before] + ' → ' + roles[details.role.after]);
    if (typeof details.blocked?.after === 'boolean') {
        changes.push(details.blocked.after ? 'Заблокирован' : 'Разблокирован');
    }
    return changes.join(', ') || '—';
}

function userProfile(viewer, record, onSave, signal, reopen) {
    const { user, history, participation } = record;
    const profile = el('div', { class: 'form-stack' }, definition([
        ['Имя', accountName(user)], ['Username', user.username], ['ID', user.id], ['Telegram ID', user.telegram_id],
        ['Роль', taggedRole(user.role)], ['Статус', accountStatus(user.blocked)],
        ['Регистрация', date(user.created_at)], ['Последний вход', date(user.last_login_at)],
    ]), viewer.role === 'SUPERADMIN' && el('div', { class: 'toolbar' },
        button('Сессии и история входов', () => showUserSessions(user, signal, reopen), 'subtle')));
    if (viewer.role === 'SUPERADMIN' && !user.telegram_id && !user.blocked
        && participantRoles.some(([role]) => role === user.role)) {
        profile.append(el('div', { class: 'toolbar' },
            button('Выдать новый код входа', () => reissueCode(user, signal), 'subtle')));
    }
    const canEdit = viewer.id !== user.id && (viewer.role === 'SUPERADMIN' || user.role === 'USER' || user.role === 'JURY');
    if (canEdit) {
        const allowedRoles = viewer.role === 'SUPERADMIN' ? Object.entries(roles) : participantRoles;
        const form = el('form', { class: 'form-stack panel' }, el('h3', {}, 'Права доступа'),
            selectField('Роль пользователя', 'role', allowedRoles, user.role),
            toggle('Заблокировать доступ', 'blocked', user.blocked),
            el('p', { class: 'muted' }, 'Блокировка завершает активные сессии пользователя.'),
            el('label', { class: 'switch' }, el('input', { type: 'checkbox', name: 'confirmed', required: true }),
                'Подтверждаю изменение доступа'), formError(),
            el('div', { class: 'dialog-actions' }, submit('Сохранить права')));
        bindForm(form, async fields => {
            const changed = { confirmed: true };
            if (fields.get('role') !== user.role) changed.role = fields.get('role');
            if (fields.has('blocked') !== user.blocked) changed.blocked = fields.has('blocked');
            if (Object.keys(changed).length > 1) {
                await request('/admin/users/' + user.id, { method: 'PATCH', data: changed, signal });
                toast('Права пользователя сохранены.');
            }
            if (!signal.aborted) await onSave();
        });
        profile.append(form);
    }
    profile.append(
        el('h3', {}, 'Участие в голосовании'),
        table(['Номинация', 'Дата голосования'], participation.map(ballot => [ballot.title, date(ballot.voted_at)]),
            'Пользователь пока не голосовал.'),
        el('h3', {}, 'История действий'),
        table(['Действие', 'Кто выполнил', 'Изменение', 'Дата'], history.map(entry => [
            actionLabels[entry.action] || entry.action, entry.actor_display_name || entry.actor_telegram_id || 'Система',
            historyChange(entry), date(entry.created_at),
        ]), 'История пока пуста.'),
    );
    return profile;
}

export async function loadUsers(viewer, signal, { query: initialQuery = '' } = {}) {
    const pageSize = 50;
    const visibleRoles = viewer.role === 'SUPERADMIN' ? Object.entries(roles) : participantRoles;
    const statusChoices = [['', 'Все статусы'], ['false', 'Активен'], ['true', 'Заблокирован']];
    const activityChoices = [['', 'Любой вход'], ['recent', 'За последние 30 дней'],
        ['inactive', 'Больше 30 дней назад'], ['never', 'Ещё не входили']];
    const { params } = readPanelUrl();
    const accountId = params.get('user');
    if (accountId) {
        params.delete('user');
        const query = params.toString();
        const back = '#users' + (query ? '?' + query : '');
        const content = el('div', { class: 'panel', 'aria-busy': 'true' });
        const title = heading('Профиль пользователя', '', el('a', { class: 'button subtle', href: back }, 'К списку пользователей'));
        async function refreshProfile() {
            content.setAttribute('aria-busy', 'true');
            try {
                const record = await request('/admin/users/' + encodeURIComponent(accountId), { signal });
                if (signal.aborted) return;
                title.querySelector('h1').textContent = accountName(record.user);
                content.replaceChildren(userProfile(viewer, record, refreshProfile, signal, () => {
                    document.getElementById('dialog').close();
                    return refreshProfile();
                }));
            } catch (error) {
                if (!signal.aborted) content.replaceChildren(notice(error.message, true),
                    button('Повторить', refreshProfile, 'subtle'));
            } finally {
                content.removeAttribute('aria-busy');
            }
        }
        await refreshProfile();
        return el('section', { class: 'page-stack' }, title, content);
    }
    const search = el('form', { class: 'filters' },
        textField('Поиск', 'q', initialQuery, { type: 'search', maxlength: 120, placeholder: 'Имя, логин, ID или Telegram ID' }),
        selectField('Роль', 'role', [['', 'Все роли'], ...visibleRoles], optionParam(params, 'role', visibleRoles)),
        selectField('Статус', 'blocked', statusChoices, optionParam(params, 'blocked', statusChoices)),
        selectField('Последний вход', 'activity', activityChoices, optionParam(params, 'activity', activityChoices)),
        selectField('Сортировка', 'sort', accountSort, optionParam(params, 'sort', accountSort, 'created_desc')), submit('Найти'));
    const message = notice('', true);
    const list = el('div');
    const root = el('section', {}, heading('Пользователи', 'Аккаунты участников, роли и участие в голосовании.'), search, message, list);
    let requestedPage = 0;
    let currentPage = 1;
    let filters = new URLSearchParams();

    function profileLink(user) {
        const { params } = readPanelUrl();
        params.set('user', user.id);
        return el('a', { class: 'button subtle compact', href: '#users?' + params.toString(),
            'aria-label': 'Профиль · ' + accountName(user) }, 'Профиль');
    }

    async function refresh(page = currentPage, persist = true) {
        if (signal.aborted) return;
        if (persist) updatePanelUrl({
            role: filters.get('role'),
            blocked: filters.get('blocked'),
            activity: filters.get('activity'),
            sort: filters.get('sort') === 'created_desc' ? null : filters.get('sort'),
            // Pages of a private search do not describe the shareable result set.
            page: !filters.has('q') && page > 1 ? page : null,
        });
        const requestId = ++requestedPage;
        const query = new URLSearchParams(filters);
        query.set('offset', String((page - 1) * pageSize));
        list.setAttribute('aria-busy', 'true');
        message.textContent = '';
        try {
            const users = await request('/admin/users?' + query, { signal });
            if (signal.aborted || requestedPage !== requestId) return;
            currentPage = page;
            list.replaceChildren(table(['Имя и ID', 'Telegram ID', 'Роль', 'Статус', 'Регистрация', 'Последний вход', ''],
                users.map(user => [
                    el('span', { class: 'stacked-text' }, el('strong', {}, accountName(user) + (user.id === viewer.id ? ' · Вы' : '')),
                        el('small', { class: 'mono' }, user.id)),
                    el('span', { class: 'mono nowrap' }, user.telegram_id || '—'), taggedRole(user.role), accountStatus(user.blocked),
                    date(user.created_at), date(user.last_login_at),
                    profileLink(user),
                ]), 'Пользователи не найдены.'), pager(page, users.length === pageSize, refresh) || '');
        } catch (error) {
            if (!signal.aborted && requestedPage === requestId) message.textContent = error.message;
        } finally {
            if (requestedPage === requestId) list.removeAttribute('aria-busy');
        }
    }

    function applyFilters(page = 1, persist = true) {
        filters = new URLSearchParams();
        for (const [key, value] of new FormData(search)) {
            if (value.trim()) filters.set(key, value.trim());
        }
        return refresh(page, persist);
    }

    search.addEventListener('submit', event => { event.preventDefault(); void applyFilters(); });
    search.addEventListener('change', event => { if (event.target.tagName === 'SELECT') void applyFilters(); });
    await applyFilters(initialQuery ? 1 : pageParam(params, 2_000_000), false);
    return root;
}

function canManageInvitation(viewer, invitation) {
    return viewer.id === invitation.creator_id || viewer.role === 'SUPERADMIN';
}

function showIssuedInvitation(invitation, title = 'Приглашение создано') {
    const signIn = new URL('/sign-in', location.origin).href;
    showDialog(title, el('div', { class: 'form-stack' },
        notice('Передайте код участнику лично. Его можно использовать один раз на странице входа.'),
        el('code', { class: 'secret invitation-code' }, invitation.code),
        definition([['Роль', roles[invitation.role]], ['Действует до', invitation.expires_at ? date(invitation.expires_at) : 'Бессрочно'],
            ['Telegram', 'Статус доставки неизвестен']]),
        el('div', { class: 'toolbar' }, clipboardButton('Скопировать код', invitation.code),
            clipboardButton('Скопировать ссылку на вход', signIn),
            el('a', { class: 'text-link', href: signIn, target: '_blank', rel: 'noopener noreferrer' }, 'Открыть страницу входа'))));
}

function showIssuedBatch(invitations) {
    showDialog('Коды созданы', el('div', { class: 'form-stack' },
        notice('Передайте каждому участнику его одноразовый код и ссылку на вход.'),
        el('p', { class: 'muted' }, 'Telegram: статус доставки неизвестен.'),
        el('ol', { class: 'admin-invite-codes' }, invitations.map(invitation => el('li', {},
            el('code', { class: 'secret invitation-code' }, invitation.code),
            el('div', { class: 'toolbar' }, clipboardButton('Скопировать код', invitation.code))))),
        clipboardButton('Скопировать ссылку на вход', new URL('/sign-in', location.origin).href)));
}

function reissueCode(user, signal) {
    const form = el('form', { class: 'form-stack' },
        el('p', {}, 'Выдайте код только после проверки личности. Предыдущий неиспользованный код перестанет действовать.'),
        el('label', { class: 'switch' }, el('input', { type: 'checkbox', name: 'confirmed', required: true }),
            'Я проверил личность пользователя'),
        formError(), el('div', { class: 'dialog-actions' }, submit('Выдать код')));
    bindForm(form, async () => {
        const invitation = await request('/admin/invitations/users/' + user.id + '/reissue', {
            method: 'POST', signal, data: { confirmed: true },
        });
        if (signal.aborted || !form.isConnected) return;
        showIssuedInvitation(invitation, 'Новый код входа');
    });
    showDialog('Выдача кода · ' + accountName(user), form);
}

function createInvitation(onSave, signal) {
    const form = el('form', { class: 'form-stack' },
        textField('Имя участника', 'displayName', '', { required: true, maxlength: 120 }),
        selectField('Роль', 'role', participantRoles, 'JURY'),
        el('p', { class: 'muted' }, 'Код используется один раз; срок действия будет указан после создания.'),
        formError(), el('div', { class: 'dialog-actions' }, submit('Создать приглашение')));
    bindForm(form, async fields => {
        const invitation = await request('/admin/invitations', { method: 'POST', signal, data: {
            displayName: fields.get('displayName'), role: fields.get('role'),
        } });
        if (signal.aborted || !form.isConnected) return;
        showIssuedInvitation(invitation);
        await onSave(1);
    });
    showDialog('Создать приглашение', form);
}

function createBatch(onSave, signal) {
    const form = el('form', { class: 'form-stack' },
        selectField('Роль', 'role', participantRoles, 'JURY'),
        textField('Количество кодов', 'count', '5', { type: 'number', required: true, min: 1, max: 25 }),
        el('p', { class: 'muted' }, 'Система создаст аккаунт и одноразовый код для каждого участника.'),
        el('label', { class: 'switch' }, el('input', { type: 'checkbox', name: 'confirmed', required: true }), 'Подтверждаю выпуск пакета'),
        formError(), el('div', { class: 'dialog-actions' }, submit('Выпустить пакет')));
    bindForm(form, async fields => {
        const invitations = await request('/admin/nexus/invitations/bulk', { method: 'POST', signal, data: {
            role: fields.get('role'), count: Number(fields.get('count')), confirmed: fields.has('confirmed'),
        } });
        if (signal.aborted || !form.isConnected) return;
        showIssuedBatch(invitations);
        await onSave(1);
    });
    showDialog('Выпустить пакет приглашений', form);
}

export async function loadInvitations(viewer, signal, { create = false } = {}) {
    const pageSize = 100;
    const list = el('div');
    const message = notice('', true);
    const { params } = readPanelUrl();
    const statusChoices = Object.entries(invitationStatus).map(([key, value]) => [key, value[0]]);
    const roleFilter = selectField('Роль', 'role', [['', 'Все роли'], ...participantRoles], optionParam(params, 'role', participantRoles));
    const statusFilter = selectField('Статус', 'status', [['', 'Все статусы'], ...statusChoices], optionParam(params, 'status', statusChoices));
    const filters = el('div', { class: 'filters' }, roleFilter, statusFilter);
    const root = el('section', {}, heading('Приглашения', 'Доступ участникам и жюри по коду.',
        button('Создать пакет', () => createBatch(refresh, signal), 'subtle'),
        button('Создать приглашение', () => createInvitation(refresh, signal), 'primary')), filters, message, list);
    let requestedPage = 0;
    let currentPage = 1;
    for (const filter of [roleFilter, statusFilter]) filter.querySelector('select').addEventListener('change', () => refresh(1), { signal });

    function showUses(invitation) {
        return viewDialog('Использование приглашения', signal, async () => {
            const uses = await request('/admin/invitations/' + invitation.id + '/uses', { signal });
            return table(['Аккаунт', 'Дата активации'], uses.map(use => [el('span', { class: 'stacked-text' },
                el('strong', {}, use.display_name), el('small', { class: 'mono' }, use.user_id)), date(use.used_at)]),
            'Код ещё никто не активировал.');
        });
    }

    function revoke(invitation) {
        confirmAction('Отозвать приглашение?', 'После отзыва по коду нельзя зарегистрироваться. Аккаунты, созданные ранее, сохранятся.',
            'Отозвать код', async () => {
                await request('/admin/invitations/' + invitation.id + '/revoke', { method: 'POST', signal });
                toast('Приглашение отозвано.');
                await refresh();
            });
    }

    async function refresh(page = currentPage, persist = true) {
        if (signal.aborted) return;
        const role = roleFilter.querySelector('select').value;
        const invitationState = statusFilter.querySelector('select').value;
        if (persist) updatePanelUrl({ role, status: invitationState, page: page > 1 ? page : null });
        const requestId = ++requestedPage;
        list.setAttribute('aria-busy', 'true');
        message.textContent = '';
        try {
            const query = new URLSearchParams({ page: String(page), role, status: invitationState });
            const invitations = await request('/admin/invitations?' + query, { signal });
            if (signal.aborted || requestedPage !== requestId) return;
            currentPage = page;
            list.replaceChildren(table(['Роль', 'Статус', 'Использовано', 'Кем создано', 'Дата создания', 'Действует до', ''],
                invitations.map(invitation => [taggedRole(invitation.role), status(...invitationStatus[invitation.status]),
                    `${numbers.format(invitation.use_count)} из ${numbers.format(invitation.max_uses)}`, invitation.creator_name || '—',
                    date(invitation.created_at), invitation.expires_at ? date(invitation.expires_at) : 'Бессрочно',
                    canManageInvitation(viewer, invitation) && el('div', { class: 'toolbar' },
                        button('Использования', () => showUses(invitation), 'subtle compact'),
                        invitation.status === 'active' && button('Отозвать', () => revoke(invitation), 'danger compact')),
                ]), 'На этой странице нет приглашений.'), pager(page, invitations.length === pageSize, refresh) || '');
        } catch (error) {
            if (!signal.aborted && requestedPage === requestId) message.textContent = error.message;
        } finally {
            if (requestedPage === requestId) list.removeAttribute('aria-busy');
        }
    }

    await refresh(pageParam(params, 10_000), false);
    if (create && !signal.aborted) createInvitation(refresh, signal);
    return root;
}
