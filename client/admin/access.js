import {
    bindForm, button, clipboardButton, confirmAction, date, definition, el, formError,
    heading, notice, numbers, request, roles, selectField, showDialog, status, submit, table, textField, toast, toggle,
} from './ui.js';
import { showUserSessions } from './management.js';

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
        ['Имя', accountName(user)], ['ID', user.id], ['Telegram ID', user.telegram_id],
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
            if (!signal.aborted && form.isConnected) document.getElementById('dialog').close();
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
    const search = el('form', { class: 'filters' },
        textField('Поиск', 'q', initialQuery, { type: 'search', maxlength: 120, placeholder: 'Имя, логин, ID или Telegram ID' }),
        selectField('Роль', 'role', [['', 'Все роли'], ...visibleRoles]),
        selectField('Статус', 'blocked', [['', 'Все статусы'], ['false', 'Активен'], ['true', 'Заблокирован']]),
        selectField('Сортировка', 'sort', accountSort, 'created_desc'), submit('Найти'));
    const message = notice('', true);
    const list = el('div');
    const root = el('section', {}, heading('Пользователи', 'Аккаунты участников, роли и участие в голосовании.'), search, message, list);
    let requestedPage = 0;
    let currentPage = 1;
    let filters = new URLSearchParams();

    function openProfile(user) {
        return viewDialog(accountName(user), signal, async () => userProfile(viewer,
            await request('/admin/users/' + user.id, { signal }), refresh, signal, () => openProfile(user)));
    }

    async function refresh(page = currentPage) {
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
                    button('Профиль', () => openProfile(user), 'subtle compact',
                    { 'aria-label': 'Профиль · ' + accountName(user) }),
                ]), 'Пользователи не найдены.'), pager(page, users.length === pageSize, refresh) || '');
        } catch (error) {
            if (!signal.aborted && requestedPage === requestId) message.textContent = error.message;
        } finally {
            if (requestedPage === requestId) list.removeAttribute('aria-busy');
        }
    }

    function applyFilters() {
        filters = new URLSearchParams();
        for (const [key, value] of new FormData(search)) {
            if (value.trim()) filters.set(key, value.trim());
        }
        return refresh(1);
    }

    search.addEventListener('submit', event => { event.preventDefault(); void applyFilters(); });
    search.addEventListener('change', event => { if (event.target.tagName === 'SELECT') void applyFilters(); });
    await applyFilters();
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
        definition([['Роль', roles[invitation.role]], ['Действует до', 'Бессрочно']]),
        el('div', { class: 'toolbar' }, clipboardButton('Скопировать код', invitation.code),
            clipboardButton('Скопировать ссылку на вход', signIn),
            el('a', { class: 'text-link', href: signIn, target: '_blank', rel: 'noopener noreferrer' }, 'Открыть страницу входа'))));
}

function showIssuedBatch(invitations) {
    showDialog('Коды созданы', el('div', { class: 'form-stack' },
        notice('Коды бессрочные и одноразовые. Передайте каждому участнику его код и ссылку на вход.'),
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
        el('p', { class: 'muted' }, 'Код бессрочный и используется один раз.'),
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
        el('p', { class: 'muted' }, 'Система создаст аккаунт и бессрочный одноразовый код для каждого участника.'),
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
    const root = el('section', {}, heading('Приглашения', 'Доступ участникам и жюри по коду.',
        button('Создать пакет', () => createBatch(refresh, signal), 'subtle'),
        button('Создать приглашение', () => createInvitation(refresh, signal), 'primary')), message, list);
    let requestedPage = 0;
    let currentPage = 1;

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

    async function refresh(page = currentPage) {
        const requestId = ++requestedPage;
        list.setAttribute('aria-busy', 'true');
        message.textContent = '';
        try {
            const invitations = await request('/admin/invitations?page=' + page, { signal });
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

    await refresh();
    if (create && !signal.aborted) createInvitation(refresh, signal);
    return root;
}
