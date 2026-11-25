export const roles = { USER: 'Участник', JURY: 'Жюри', MANAGER: 'Администратор', SUPERADMIN: 'Владелец' };
export const nominationStatuses = { draft: 'Черновик', open: 'Открыта', closed: 'Закрыта' };
export const numbers = new Intl.NumberFormat('ru-RU');
const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

export function date(value) {
    return value ? dateFormat.format(new Date(value)) : '—';
}

export function dateInput(value) {
    if (!value) return '';
    const timestamp = new Date(value);
    return new Date(+timestamp - timestamp.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function el(tag, attributes = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        if (value == null || value === false) continue;
        if (name.startsWith('on')) node.addEventListener(name.slice(2).toLowerCase(), value);
        else node.setAttribute(name, value === true ? '' : value);
    }
    node.append(...children.flat(Infinity).filter(child => child != null && child !== false));
    return node;
}

export function button(label, action, style = '', attributes = {}) {
    return el('button', { type: 'button', class: 'button ' + style, onClick: action, ...attributes }, label);
}

export function heading(title, description, ...actions) {
    return el('header', { class: 'heading' },
        el('div', {}, el('h1', {}, title), description && el('p', { class: 'lede' }, description)),
        actions.length ? el('div', { class: 'toolbar' }, actions) : null);
}

export function status(label, tone = '') {
    return el('span', { class: 'status ' + tone }, label);
}

export function textField(label, name, value = '', attributes = {}) {
    const input = el('input', { name, value, ...attributes });
    if (attributes.type !== 'search') return el('label', { class: 'field' }, label, input);
    const clear = button('×', () => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }, 'search-clear', { 'aria-label': 'Очистить поиск' });
    function syncClear() { clear.hidden = !input.value; }
    input.addEventListener('input', syncClear);
    syncClear();
    return el('label', { class: 'field' }, label, el('span', { class: 'search-control' }, el('span', { class: 'search-icon', 'aria-hidden': 'true' }, '⌕'), input, clear));
}

let selectCounter = 0;
export function selectField(label, name, choices, selected = '') {
    const id = 'field-select-' + ++selectCounter;
    const select = el('select', { name, hidden: true }, choices.map(([value, caption]) =>
        el('option', { value, selected: String(value) === String(selected) }, caption)));
    const caption = el('span', { id: id + '-label' }, label);
    const value = el('span', { id: id + '-value' });
    const menu = el('div', { class: 'select-menu', id, popover: 'auto', role: 'listbox', 'aria-labelledby': caption.id });
    const trigger = button(value, open, 'select-trigger', {
        'aria-haspopup': 'listbox', 'aria-controls': id, 'aria-expanded': 'false',
        'aria-labelledby': caption.id + ' ' + value.id, disabled: !choices.length,
    });
    const options = choices.map(([key, text]) => button(text, () => {
        select.value = key;
        menu.hidePopover();
        trigger.focus();
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }, 'select-option', { tabindex: -1, role: 'option' }));
    function sync() {
        value.textContent = select.selectedOptions[0]?.textContent ?? 'Нет вариантов';
        options.forEach((option, index) => option.setAttribute('aria-selected', String(index === select.selectedIndex)));
    }
    function open() {
        if (menu.matches(':popover-open')) { menu.hidePopover(); return; }
        const box = trigger.getBoundingClientRect();
        const below = innerHeight - box.bottom;
        const above = box.top;
        menu.style.left = box.left + 'px';
        menu.style.width = box.width + 'px';
        menu.style.maxHeight = Math.max(48, Math.min(260, Math.max(above, below) - 12)) + 'px';
        menu.style.top = below >= above ? box.bottom + 4 + 'px' : 'auto';
        menu.style.bottom = below < above ? innerHeight - box.top + 4 + 'px' : 'auto';
        menu.showPopover();
        (options[select.selectedIndex] ?? options[0])?.focus();
    }
    trigger.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(); }
    });
    menu.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', String(menu.matches(':popover-open'))));
    menu.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); menu.hidePopover(); trigger.focus(); return; }
        if (event.key === 'Tab') { menu.hidePopover(); trigger.focus(); return; }
        const index = options.indexOf(document.activeElement);
        const next = { Home: 0, End: options.length - 1, ArrowDown: index + 1, ArrowUp: index - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        options[Math.max(0, Math.min(options.length - 1, next))]?.focus();
    });
    select.addEventListener('change', sync);

    menu.append(...options);
    sync();
    return el('div', { class: 'field' }, caption, select, trigger, menu);
}

export function toggle(label, name, checked, disabled = false) {
    return el('label', { class: 'switch' }, el('input', { type: 'checkbox', role: 'switch', name, checked, disabled }), label);
}

export function table(headers, rows, empty = 'Нет записей') {
    if (!rows.length) return el('p', { class: 'panel empty' }, empty);
    return el('div', { class: 'table-frame', tabindex: '0', role: 'region', 'aria-label': 'Таблица' },
        el('table', {}, el('thead', {}, el('tr', {}, headers.map(header => el('th', { scope: 'col' }, header)))),
            el('tbody', {}, rows.map(row => el('tr', {}, row.map(cell => el('td', {}, cell)))))));
}

export function notice(message = '', isError = false) {
    return el('p', { class: 'notice' + (isError ? ' error' : ''), role: isError ? 'alert' : 'status' }, message);
}

export function definition(rows) {
    return el('dl', { class: 'definition' }, rows.map(([key, value]) => [el('dt', {}, key), el('dd', {}, value ?? '—')]));
}

export async function request(path, { method = 'GET', data, file, signal } = {}) {
    const options = { method, credentials: 'same-origin', signal, cache: 'no-store' };
    if (file) {
        options.headers = { 'Content-Type': file.type };
        options.body = file;
    } else if (data !== undefined) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(data);
    }
    const response = await fetch('/api' + path, options);
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
        const error = new Error(result?.error?.message || 'Сервис временно недоступен. HTTP ' + response.status + '.');
        error.status = response.status;
        error.code = result?.error?.code;
        throw error;
    }
    return result.data;
}

export function bindForm(form, action) {
    const banner = form.querySelector('[data-error]');
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (form.dataset.busy) return;
        const submit = form.querySelector('[type=submit]');
        form.dataset.busy = 'true';
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
        banner.textContent = '';
        try {
            await action(new FormData(form));
        } catch (error) {
            banner.textContent = error.message;
            window.dispatchEvent(new CustomEvent('admin:activity', { detail: { kind: 'error' } }));
        } finally {
            delete form.dataset.busy;
            submit.disabled = false;
            submit.removeAttribute('aria-busy');
        }
    });
    return form;
}

export function formError() {
    const banner = notice('', true);
    banner.dataset.error = '';
    return banner;
}

export function submit(label) {
    return el('button', { class: 'button primary', type: 'submit' }, label);
}

export function showDialog(title, content) {
    const dialog = document.getElementById('dialog');
    dialog.replaceChildren(el('header', { class: 'dialog-head' }, el('h2', { id: 'dialog-title' }, title),
        button('×', () => dialog.close(), 'subtle icon-only', { 'aria-label': 'Закрыть окно' })),
    el('div', { class: 'dialog-body' }, content));
    if (!dialog.open) dialog.showModal();
    return dialog;
}

export function confirmAction(title, message, label, action) {
    let confirmed = false;
    let timer;
    const actionButton = button([label,el('span',{ class:'hold-progress','aria-hidden':'true' })],
        () => {}, 'danger hold-control', { 'aria-describedby':'hold-instructions' });
    const submitButton = submit(label);
    submitButton.hidden = true;
    const form = el('form', { class: 'form-stack' }, el('p', { class: 'muted' }, message), formError(),
        el('p',{ class:'muted',id:'hold-instructions' },'Удерживайте кнопку 1 секунду. С клавиатуры удерживайте Enter или пробел.'),
        el('div', { class: 'dialog-actions' },
            button('Отмена', () => document.getElementById('dialog').close(), 'subtle'), actionButton, submitButton));
    function cancel() {
        clearTimeout(timer);
        timer = undefined;
        actionButton.classList.remove('is-holding');
    }
    function start() {
        if (timer || form.dataset.busy) return;
        actionButton.classList.add('is-holding');
        timer = setTimeout(() => {
            cancel();
            if (!form.isConnected || !form.closest('dialog')?.open) return;
            confirmed = true;
            form.requestSubmit(submitButton);
        }, 1000);
    }
    actionButton.addEventListener('pointerdown', event => { if (event.button === 0) start(); });
    actionButton.addEventListener('keydown',event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!event.repeat) start();
        }
    });
    actionButton.addEventListener('keyup',event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); cancel(); }
    });
    for (const event of ['pointerup','pointerleave','pointercancel','blur']) actionButton.addEventListener(event,cancel);
    actionButton.addEventListener('pointermove', event => {
        const rect = actionButton.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) cancel();
    });
    bindForm(form, async () => {
        if (!confirmed) throw new Error('Удерживайте кнопку для подтверждения.');
        confirmed = false;
        await action();
        if (form.isConnected) document.getElementById('dialog').close();
    });
    showDialog(title, form);
}

let toastTimer;
export function toast(message, error = false) {
    const root = document.getElementById('notifications');
    root.replaceChildren(el('p', { class: 'toast' + (error ? ' error' : '') }, message));
    window.dispatchEvent(new CustomEvent('admin:activity', { detail: { kind: error ? 'error' : 'success' } }));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => root.replaceChildren(), 4600);
}

export function clipboardButton(label, value) {
    return button(label, async event => {
        const control = event.currentTarget;
        try {
            await navigator.clipboard.writeText(value);
            control.textContent = 'Скопировано';
        } catch {
            control.textContent = 'Выделите и скопируйте код';
        }
    }, 'subtle');
}
