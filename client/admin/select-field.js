import { el } from './dom.js';

let nextSelect = 0;

export function selectField(label, name, choices, selected = '') {
    const id = 'kit-select-' + ++nextSelect;
    const field = el('div', { class: 'field kit-field' });
    const caption = el('span', { id: id + '-label' }, label);
    const native = el('select', { name, hidden: true, 'aria-labelledby': caption.id },
        choices.map(([value, text]) => el('option', { value, selected: String(value) === String(selected) }, text)));
    const valueLabel = el('span', { id: id + '-value' });
    const list = el('div', { class: 'kit-options', id: id + '-options', role: 'listbox',
        'aria-labelledby': caption.id, tabindex: '0' });
    const selectionLight = el('div', { class: 'kit-option-light', 'aria-hidden': 'true' });
    const track = el('div', { class: 'kit-option-track' }, selectionLight);
    list.append(track);
    const search = choices.length > 8 ? el('input', { type: 'search', class: 'kit-list-search',
        role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'true', 'aria-controls': list.id,
        'aria-label': 'Поиск вариантов', placeholder: 'Найти вариант…', autocomplete: 'off' }) : null;
    const empty = el('p', { class: 'kit-option-empty', role: 'status', hidden: true }, 'Совпадений нет');
    const popover = el('div', { class: 'kit-menu', popover: 'auto', id, role: 'dialog',
        'aria-labelledby': caption.id }, search, list, empty);
    const trigger = el('button', { type: 'button', class: 'kit-select-trigger', disabled: !choices.length,
        'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': id,
        'aria-labelledby': caption.id + ' ' + valueLabel.id },
    valueLabel, el('span', { class: 'kit-chevron', 'aria-hidden': 'true' }, '⌄'));
    let active = 0;
    let prefix = '';
    let lastTyped = 0;
    const options = choices.map(([, text], index) => {
        const option = el('div', { id: id + '-option-' + index, role: 'option', 'aria-selected': 'false',
            class: 'kit-option', onClick: () => choose(index), onPointerEnter: () => focusOption(index, false) },
        el('span', { class: 'kit-option__mark', 'aria-hidden': 'true' }, '◆'), el('span', {}, text),
        el('span', { class: 'kit-option__check', 'aria-hidden': 'true' }, '✓'));
        option.style.setProperty('--kit-step', Math.min(index, 10));
        return option;
    });
    track.append(...options);
    function sync() {
        valueLabel.textContent = native.selectedOptions[0]?.textContent ?? 'Нет вариантов';
        options.forEach((option, index) => option.setAttribute('aria-selected', String(index === native.selectedIndex)));
    }
    function focusOption(index, scroll = true) {
        delete options[active]?.dataset.active;
        active = index;
        const option = options[index];
        const control = search ?? list;
        if (!option) {
            control.removeAttribute('aria-activedescendant');
            delete track.dataset.highlight;
            return;
        }
        option.dataset.active = '';
        control.setAttribute('aria-activedescendant', option.id);
        if (scroll) {
            const top = option.offsetTop;
            if (top < list.scrollTop) list.scrollTop = top;
            else if (top + option.offsetHeight > list.scrollTop + list.clientHeight) {
                list.scrollTop = top + option.offsetHeight - list.clientHeight;
            }
        }
        selectionLight.style.setProperty('--option-y', option.offsetTop + 'px');
        selectionLight.style.setProperty('--option-height', option.offsetHeight + 'px');
        track.dataset.highlight = '';
    }
    function filter() {
        const query = search?.value.trim().toLocaleLowerCase('ru') ?? '';
        options.forEach((option, index) => { option.hidden = !String(choices[index][1]).toLocaleLowerCase('ru').includes(query); });
        const first = options.findIndex(option => !option.hidden);
        empty.hidden = first >= 0;
        focusOption(first);
    }
    function close() {
        popover.hidePopover();
        trigger.focus();
    }
    function choose(index) {
        if (index < 0 || options[index].hidden) return;
        const changed = native.selectedIndex !== index;
        native.selectedIndex = index;
        close();
        if (changed) native.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function open() {
        if (popover.matches(':popover-open')) { close(); return; }
        const bounds = trigger.getBoundingClientRect();
        const below = innerHeight - bounds.bottom;
        const above = bounds.top;
        const width = Math.min(innerWidth - 20, Math.max(bounds.width, 240));
        popover.style.width = width + 'px';
        popover.style.left = Math.max(10, Math.min(bounds.left, innerWidth - width - 10)) + 'px';
        popover.style.top = below >= above ? bounds.bottom + 6 + 'px' : 'auto';
        popover.style.bottom = below < above ? innerHeight - bounds.top + 6 + 'px' : 'auto';
        list.style.maxHeight = Math.max(65, Math.min(300, Math.max(above, below) - (search ? 70 : 20))) + 'px';
        if (search) search.value = '';
        popover.showPopover({ source: trigger });
        filter();
        focusOption(native.selectedIndex);
        (search ?? list).focus({ preventScroll: true });
    }
    trigger.addEventListener('click', open);
    trigger.addEventListener('keydown', event => {
        if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
        event.preventDefault();
        if (!popover.matches(':popover-open')) open();
    });
    popover.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', String(popover.matches(':popover-open'))));
    search?.addEventListener('input', filter);
    native.addEventListener('change', sync);
    popover.addEventListener('pointerdown', event => { if (event.target.closest('.kit-option')) event.preventDefault(); });
    popover.addEventListener('keydown', event => {
        const { key } = event;
        if (key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
        if (key === 'Tab') { close(); return; }
        if (key === 'Enter') { event.preventDefault(); choose(active); return; }
        const available = options.flatMap((option, index) => option.hidden ? [] : [index]);
        const position = available.indexOf(active);
        if (key === 'ArrowDown' || key === 'ArrowUp' || (!search && ['Home', 'End'].includes(key))) {
            event.preventDefault();
            const next = { ArrowDown: Math.min(available.length - 1, position + 1), ArrowUp: Math.max(0, position - 1),
                Home: 0, End: available.length - 1 }[key];
            focusOption(available[next] ?? -1);
        } else if (!search && key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const time = performance.now();
            prefix = (time - lastTyped < 600 ? prefix : '') + key.toLocaleLowerCase('ru');
            lastTyped = time;
            const match = available.find(index => String(choices[index][1]).toLocaleLowerCase('ru').startsWith(prefix));
            if (match !== undefined) focusOption(match);
            event.preventDefault();
        }
    });
    sync();
    field.append(caption, native, trigger, popover);
    return field;
}
