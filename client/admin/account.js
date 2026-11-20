import { bindForm, clipboardButton, el, formError, notice, request, roles, submit, textField } from './ui.js';

const root = document.getElementById('account-form');
const tabs = [...document.querySelectorAll('.account-tabs a')];
const search = new URLSearchParams(location.search);
const requestedReturn = search.get('return_to');
const returnPath = requestedReturn === '/admin' ? '/admin' : '/nominations';
const modes = {
    login: { description: 'Войдите с именем аккаунта и паролем, которые задали при регистрации.', submit: 'Войти', path: '/auth/password/login' },
    invite: { description: 'Введите приглашение от организатора и придумайте данные для следующих входов.', submit: 'Создать аккаунт', path: '/auth/invitations/redeem' },
    recover: { description: 'Для смены пароля нужен ключ восстановления, который был показан при регистрации.', submit: 'Сменить пароль', path: '/auth/password/recover' },
};

function complete(result) {
    if (!result.recoveryKey) {
        location.replace(returnPath);
        return;
    }
    root.replaceChildren(el('section', { class: 'form-stack' },
        el('h2', {}, 'Сохраните ключ восстановления'),
        notice('Ключ показывается один раз. Храните его отдельно от пароля. При восстановлении будет выдан новый ключ.'),
        el('code', { class: 'secret' }, result.recoveryKey),
        el('p', { class: 'muted' }, 'Вы вошли. Роль: ' + (roles[result.user.role] || result.user.role) + '.'),
        el('div', { class: 'toolbar' }, clipboardButton('Скопировать ключ', result.recoveryKey),
            el('a', { class: 'button primary', href: returnPath }, 'Продолжить'))));
    tabs.forEach(tab => tab.removeAttribute('aria-current'));
}

function render() {
    const [requestedMode, fragmentQuery] = location.hash.slice(1).split('?', 2);
    const mode = Object.hasOwn(modes, requestedMode) ? requestedMode : 'login';
    const linkedCode = mode === 'invite' && new URLSearchParams(fragmentQuery).get('code');
    const invitationCode = typeof linkedCode === 'string' && /^ITD-[A-Za-z0-9_-]{43}$/.test(linkedCode) ? linkedCode : '';
    if (mode === 'invite' && fragmentQuery !== undefined) history.replaceState(history.state, '', '#invite');
    const current = modes[mode];
    for (const tab of tabs) {
        if (tab.hash === '#' + mode) tab.setAttribute('aria-current', 'true');
        else tab.removeAttribute('aria-current');
    }
    const form = el('form', { class: 'form-stack' }, el('p', { class: 'muted' }, current.description),
        mode === 'invite' && textField('Код приглашения', 'code', invitationCode, { required: true, maxlength: 100, autocomplete: 'one-time-code', spellcheck: 'false' }),
        textField('Имя аккаунта', 'username', '', { required: true, minlength: 3, maxlength: 40, pattern: '[A-Za-z0-9][A-Za-z0-9_.\\-]{2,39}', title: 'Начните с латинской буквы или цифры. Можно использовать точку, дефис и нижнее подчёркивание.', autocomplete: 'username', spellcheck: 'false' }),
        mode === 'invite' && textField('Отображаемое имя', 'displayName', '', { required: true, maxlength: 120, autocomplete: 'nickname' }),
        mode === 'recover' && textField('Ключ восстановления', 'recoveryKey', '', { required: true, maxlength: 128, spellcheck: 'false', autocomplete: 'off' }),
        textField(mode === 'recover' ? 'Новый пароль' : 'Пароль', mode === 'recover' ? 'newPassword' : 'password', '',
            { type: 'password', required: true, minlength: 12, maxlength: 128, autocomplete: mode === 'login' ? 'current-password' : 'new-password' }),
        formError(), el('div', { class: 'dialog-actions' }, submit(current.submit)));
    bindForm(form, async fields => {
        const result = await request(current.path, { method: 'POST', data: Object.fromEntries(fields) });
        complete(result);
    });
    root.replaceChildren(form);
}

window.addEventListener('hashchange', render);
render();
