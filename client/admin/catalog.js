import { bindForm, button, confirmAction, el, formError, heading, nominationStatuses,
    numbers, request, selectField, showDialog, status, submit, table, textField, toast, toggle } from './ui.js';

function safeImage(value) {
    if (!value) return null;
    if (/^\/api\/media\/[a-f0-9]{64}$/.test(value)) return value;
    if (/^\/(?:assets|images)\//.test(value) && !value.includes('\\')) return value;
    try {
        const address = new URL(value);
        return address.protocol === 'https:' && !address.username && !address.password ? address.href : null;
    } catch {
        return null;
    }
}

function cover(item, small = false) {
    const src = safeImage(item.image_url);
    const result = el('span', { class: small ? 'cover small' : 'cover', 'aria-hidden': 'true' }, '✶');
    if (src) {
        const image = el('img', { src, alt: '', loading: 'lazy', decoding: 'async' });
        image.addEventListener('error', () => result.replaceChildren('✶'), { once: true });
        result.replaceChildren(image);
    }
    return result;
}

function availability(row) {
    if (row.archived) return status('В архиве');
    return status(nominationStatuses[row.status], row.status === 'open' ? 'ok' : '');
}

export async function loadCatalog(_operator, signal, { nominationId, nomineeId } = {}) {
    const root = el('section');
    const list = el('div', { class: 'catalog-index' });
    const detail = el('section', { class: 'catalog-detail panel' });
    const catalogNotice = formError();
    let rows = [];
    let selected = Number(nominationId) || undefined;
    let focusedNominee = Number(nomineeId) || undefined;
    let voteCounts = new Map();
    let showArchived = false;
    const selectedNominations = new Set();
    const selectedNominees = new Set();
    const bulkButton = button('Групповое изменение', bulkEdit, 'subtle', { disabled: true });
    const search = textField('Поиск по номинациям и номинантам', 'catalog-search', '', { type: 'search', autocomplete: 'off' });
    search.querySelector('input').addEventListener('input', draw);
    const archive = toggle('Показать архив', 'catalog-archive', false);
    archive.querySelector('input').addEventListener('change', event => { showArchived = event.target.checked; draw(); });

    async function readRows() {
        const [catalog, stats] = await Promise.all([request('/admin/catalog', { signal }), request('/admin/stats', { signal })]);
        rows = catalog;
        voteCounts = new Map(stats.nomination_votes.map(row => [row.id, row.vote_count]));
        draw();
    }

    function selectionState() {
        const count = selectedNominations.size + selectedNominees.size;
        bulkButton.disabled = count === 0;
        bulkButton.textContent = 'Групповое изменение' + (count ? ' (' + count + ')' : '');
    }

    function selectRow(kind, id, label) {
        const selection = kind === 'nomination' ? selectedNominations : selectedNominees;
        return el('input', { type: 'checkbox', checked: selection.has(id), 'aria-label': 'Выбрать · ' + label,
            onChange: event => {
                if (event.target.checked) selection.add(id);
                else selection.delete(id);
                selectionState();
            } });
    }

    function draw() {
        const query = search.querySelector('input').value.trim().toLocaleLowerCase('ru-RU');
        const matches = value => value?.toLocaleLowerCase('ru-RU').includes(query);
        const filtered = rows.filter(row => (showArchived || !row.archived) &&
            (!query || matches(row.title) || row.nominees.some(nominee => (showArchived || !nominee.archived) && matches(nominee.name))));
        const active = filtered.find(row => row.id === selected) ?? filtered[0];
        selected = active?.id;
        list.replaceChildren(...filtered.map(row => el('button', {
            type: 'button', class: 'catalog-choice', 'aria-current': row.id === selected ? 'true' : null,
            onClick: () => { selected = row.id; focusedNominee = undefined; draw(); },
        }, el('span', {}, row.title), availability(row))));
        if (!filtered.length) list.append(el('p', { class: 'empty' }, 'Номинации не найдены.'));
        if (!active) {
            detail.replaceChildren(el('p', { class: 'empty' }, 'Выберите или создайте номинацию.'));
            return;
        }
        const nominees = active.nominees.filter(nominee => (showArchived || !nominee.archived)
            && (!query || matches(active.title) || matches(nominee.name)));
        const votes = voteCounts.get(active.id) ?? 0;
        detail.replaceChildren(
            el('header', { class: 'catalog-cover' }, cover(active), el('div', { class: 'form-stack' },
                el('h2', {}, active.title), availability(active))),
            el('p', { class: 'muted' }, active.description || 'Описание ещё не задано.'),
            el('div', { class: 'catalog-meta' },
                el('span', {}, 'Голосов: ' + numbers.format(votes)), el('span', {}, 'Порядок: ' + active.sort_order)),
            el('div', { class: 'toolbar catalog-actions' },
                el('label', { class: 'toolbar' }, selectRow('nomination', active.id, active.title), 'Выбрать номинацию'),
                active.status !== 'draft' && !active.archived
                    ? el('a', { class: 'button subtle', href: '/nominations/' + active.id, target: '_blank', rel: 'noopener noreferrer' }, 'Публичная страница')
                    : button('Предпросмотр', () => preview(active), 'subtle'),
                button('Редактировать номинацию', () => edit(active, false), 'subtle'),
                button('Удалить номинацию', () => remove(active, false), 'danger'),
                button('Добавить номинанта', () => edit(null, true, active.id), 'primary')),
            table(['Выбор', 'Номинант', 'Порядок', 'Статус', 'Действия'], nominees.map(nominee => [
                selectRow('nominee', nominee.id, nominee.name),
                el('span', { class: 'with-cover' }, cover(nominee, true), el('span', { class: 'stacked-text' },
                    el('strong', {}, nominee.name), nominee.handle ? el('small', {}, nominee.handle) : null,
                    nominee.id === focusedNominee ? el('span', { class: 'tag', 'data-catalog-focus': true }, 'Выбран') : null)),
                nominee.sort_order, nominee.archived ? status('В архиве') : status('В каталоге', 'ok'),
                el('div', { class: 'toolbar' }, button('Изменить', () => edit(nominee, true, active.id), 'subtle compact',
                    { 'aria-label': 'Изменить · ' + nominee.name }),
                    button('Удалить', () => remove(nominee, true), 'danger compact', { 'aria-label': 'Удалить · ' + nominee.name })),
            ]), 'В этой номинации нет подходящих номинантов.'));
    }

    function preview(nomination) {
        const visible = nomination.nominees.filter(nominee => !nominee.archived);
        showDialog('Предпросмотр · ' + nomination.title, el('div', { class: 'form-stack' },
            el('header', { class: 'catalog-cover' }, cover(nomination), el('h3', {}, nomination.title)),
            nomination.description && el('p', { class: 'muted' }, nomination.description),
            table(['Номинант', 'Описание'], visible.map(nominee => [
                el('span', { class: 'with-cover' }, cover(nominee, true), nominee.name), nominee.description || '—',
            ]), 'Видимых номинантов пока нет.')));
    }

    function bulkEdit() {
        const count = selectedNominations.size + selectedNominees.size;
        const actions = [
            ['open', 'Открыть номинации'], ['closed', 'Закрыть номинации'], ['draft', 'Перевести номинации в черновик'],
            ['archive', 'Убрать в архив'], ['restore', 'Вернуть из архива'], ['order', 'Задать порядок от указанного номера'],
        ];
        const form = el('form', { class: 'form-stack' },
            el('p', { class: 'muted' }, 'Выбрано записей: ' + count + '. Все изменения сохраняются вместе.'),
            selectField('Действие', 'action', actions),
            textField('Номер первой записи (для порядка)', 'order', '10',
                { type: 'number', min: '-2147483648', max: '2147483147', step: '1', required: true }),
            toggle('Подтверждаю применение ко всей выборке', 'confirmed', false),
            formError(), el('div', { class: 'dialog-actions' }, submit('Применить')));
        bindForm(form, async fields => {
            const action = fields.get('action');
            if (count > 50) throw new Error('За раз можно изменить до 50 записей.');
            if (!fields.has('confirmed')) throw new Error('Подтвердите групповое изменение.');
            if (['open', 'closed', 'draft'].includes(action) && selectedNominees.size) {
                throw new Error('Для изменения статуса выберите только номинации.');
            }
            const start = Number(fields.get('order'));
            const patches = identifiers => [...identifiers].map((id, index) => {
                if (action === 'order') return { id, sort_order: start + 10 * index };
                if (action === 'archive' || action === 'restore') return { id, archived: action === 'archive' };
                return { id, status: action };
            });
            await request('/admin/catalog/bulk', { method: 'POST', signal, data: { confirmed: true,
                nominations: patches(selectedNominations), nominees: patches(selectedNominees) } });
            selectedNominations.clear();
            selectedNominees.clear();
            selectionState();
            if (form.isConnected) document.getElementById('dialog').close();
            await readRows();
            toast('Записи обновлены.');
        });
        showDialog('Групповое изменение', form);
    }

    function importCatalogue() {
        const form = el('form', { class: 'form-stack' },
            el('p', { class: 'muted' }, 'Добавляются новые записи. Совпадения по названию или имени сохраняются, новые номинации создаются черновиками.'),
            textField('Каталог JSON', 'file', '', { type: 'file', accept: 'application/json,.json', required: true }),
            toggle('Подтверждаю импорт', 'confirmed', false),
            formError(), el('div', { class: 'dialog-actions' }, submit('Импортировать')));
        bindForm(form, async fields => {
            if (!fields.has('confirmed')) throw new Error('Подтвердите импорт каталога.');
            const file = fields.get('file');
            if (!file?.size || file.size > 512 * 1024) throw new Error('Выберите JSON-файл до 512 КБ.');
            let catalogue;
            try {
                catalogue = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
            } catch {
                throw new Error('Файл содержит некорректный JSON.');
            }
            if (catalogue?.schema !== 1 || !Array.isArray(catalogue.nominations)) {
                throw new Error('Используйте экспорт каталога с версией схемы 1.');
            }
            const result = await request('/admin/catalog/import', { method: 'POST', signal, data: {
                confirmed: true, schema: 1, nominations: catalogue.nominations,
            } });
            if (form.isConnected) document.getElementById('dialog').close();
            await readRows();
            toast('Добавлено номинаций: ' + result.added_nominations + '. Добавлено номинантов: ' + result.added_nominees + '.');
        });
        showDialog('Импорт каталога', form);
    }

    function remove(item, nominee) {
        const endpoint = (nominee ? '/admin/nominees/' : '/admin/nominations/') + item.id;
        const title = nominee ? 'Удалить номинанта?' : 'Удалить номинацию?';
        confirmAction(title, '«' + (item.name ?? item.title) + '». Если уже есть голоса, запись можно только отправить в архив.', 'Удалить', async () => {
            await request(endpoint, { method: 'DELETE' });
            await readRows();
            toast(nominee ? 'Номинант удалён.' : 'Номинация удалена.');
        });
    }

    function edit(item, nominee, parentId) {
        const name = nominee ? 'name' : 'title';
        const endpoint = nominee ? '/admin/nominees' : '/admin/nominations';
        const title = item ? (nominee ? 'Редактировать номинанта' : 'Редактировать номинацию')
            : (nominee ? 'Добавить номинанта' : 'Создать номинацию');
        const parent = item?.nomination_id ?? parentId;
        const siblings = nominee ? (rows.find(row => row.id === parent)?.nominees ?? []) : rows;
        const lastOrder = Math.max(0, ...siblings.map(row => row.sort_order));
        const validNominations = rows.filter(row => !row.archived || row.id === parent);
        const form = el('form', { class: 'form-stack' },
            textField(nominee ? 'Имя' : 'Название', name, item?.[name] ?? '', { required: true, maxlength: 160 }),
            el('div', { class: 'form-grid' },
                nominee ? selectField('Номинация', 'nomination_id', validNominations.map(row => [row.id, row.title]), parent)
                    : selectField('Статус', 'status', Object.entries(nominationStatuses), item?.status ?? 'draft'),
                textField('Порядок отображения', 'sort_order', item?.sort_order ?? Math.min(lastOrder + 10, 2147483647),
                    { type: 'number', min: -2147483648, max: 2147483647, step: 1, required: true })),
            el('label', { class: 'field' }, 'Описание',
                el('textarea', { name: 'description', rows: 4, maxlength: 1200 }, item?.description ?? '')),
            textField('Адрес изображения', 'image_url', item?.image_url ?? '', { maxlength: 2048, placeholder: 'https://…' }),
            textField('Загрузить изображение', 'image_file', '', { type: 'file', accept: 'image/png,image/jpeg,image/webp' }),
            el('p', { class: 'muted' }, 'PNG, JPEG или WebP, до 2 МБ и 4096 × 4096. Загруженный файл заменит адрес.'),
            nominee ? el('div', { class: 'form-grid' },
                textField('Никнейм', 'handle', item?.handle ?? '', { maxlength: 100 }),
                textField('Ссылка на профиль (HTTPS)', 'link_url', item?.link_url ?? '', { maxlength: 2048 }),
                textField('Название трека', 'song', item?.song ?? '', { maxlength: 200 }),
                textField('Аудио (HTTPS или /assets/…)', 'audio_url', item?.audio_url ?? '', { maxlength: 2048 }),
                textField('Описание изображения', 'image_alt', item?.image_alt ?? '', { maxlength: 300 })) : null,
            toggle('Убрать в архив', 'archived', !!item?.archived),
            formError(), el('div', { class: 'dialog-actions' }, submit(item ? 'Сохранить' : 'Создать')));
        bindForm(form, async fields => {
            const file = fields.get('image_file');
            let imageUrl = fields.get('image_url').trim() || null;
            if (file?.size) {
                if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
                    throw new Error('Выберите изображение PNG, JPEG или WebP размером до 2 МБ.');
                }
                const upload = await request('/admin/uploads/images', { method: 'POST', file });
                imageUrl = upload.image_url;
            }
            const payload = { [name]: fields.get(name).trim(), description: fields.get('description').trim(),
                image_url: imageUrl, sort_order: Number(fields.get('sort_order')), archived: fields.has('archived') };
            if (nominee) {
                payload.nomination_id = Number(fields.get('nomination_id'));
                for (const key of ['handle', 'song', 'image_alt', 'audio_url', 'link_url']) payload[key] = fields.get(key).trim() || null;
            } else {
                payload.status = fields.get('status');
            }
            const saved = await request(endpoint + (item ? '/' + item.id : ''), { method: item ? 'PATCH' : 'POST', data: payload });
            selected = nominee ? saved.nomination_id : saved.id;
            if (!form.isConnected) return;
            document.getElementById('dialog').close();
            try { await readRows(); }
            catch (error) { catalogNotice.textContent = error.message; }
            toast(item ? 'Изменения сохранены.' : (nominee ? 'Номинант добавлен.' : 'Номинация создана.'));
        });
        showDialog(title, form);
    }

    root.append(heading('Номинации', 'Редактируйте номинации и номинантов, настраивайте порядок и статус голосования.',
        bulkButton, button('Импорт JSON', importCatalogue, 'subtle'),
        el('a', { class: 'button subtle', href: '/api/admin/catalog.json' }, 'Экспорт JSON'),
        button('Создать номинацию', () => edit(null, false), 'primary')),
    catalogNotice, el('div', { class: 'filters' }, search, archive),
    el('div', { class: 'catalog' }, el('section', { class: 'panel' }, el('div', { class: 'panel-head' }, el('h2', {}, 'Номинации')), list), detail));
    await readRows();
    if (nominationId || focusedNominee) {
        const target = rows.find(row => row.id === Number(nominationId)
            || row.nominees.some(nominee => nominee.id === focusedNominee));
        if (target) {
            selected = target.id;
            if (target.archived || target.nominees.some(nominee => nominee.id === focusedNominee && nominee.archived)) {
                showArchived = true;
                archive.querySelector('input').checked = true;
            }
            draw();
            if (focusedNominee) requestAnimationFrame(() =>
                root.querySelector('[data-catalog-focus]')?.scrollIntoView({ block: 'nearest' }));
        }
    }
    return root;
}
