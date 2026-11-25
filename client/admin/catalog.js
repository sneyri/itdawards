import { bindForm, button, confirmAction, el, formError, heading, nominationStatuses,
    numbers, readPanelData, request, selectField, showDialog, status, submit, table, textField, toast, toggle } from './ui.js';

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

const imageMedia = {
    name: 'image_file', types: ['image/png', 'image/jpeg', 'image/webp'], limit: 5 * 1024 * 1024,
    endpoint: '/admin/uploads/images', urlKey: 'image_url', label: 'Фотография',
    action: 'Перетащите фотографию сюда',
    hint: 'или нажмите, чтобы выбрать файл · PNG, JPEG, WebP до 5 МБ',
    typeError: 'Нужен PNG, JPEG или WebP.', sizeError: 'Файл больше 5 МБ.',
    dropError: 'Перетащите файл PNG, JPEG или WebP.',
    currentCaption: 'Текущее фото', previewIcon: '',
};

const audioMedia = {
    name: 'audio_file', types: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm'],
    limit: 20 * 1024 * 1024, endpoint: '/admin/uploads/audio', urlKey: 'audio_url', label: 'Аудиофайл',
    action: 'Перетащите трек сюда',
    hint: 'или нажмите, чтобы выбрать файл · MP3, M4A, WAV, OGG, WebM до 20 МБ',
    typeError: 'Нужен MP3, M4A, WAV, OGG или WebM.', sizeError: 'Файл больше 20 МБ.',
    dropError: 'Перетащите аудиофайл.',
    currentCaption: 'Текущий трек', previewIcon: '♫',
};

let uploadHintId = 0;

function safeMedia(value) {
    if (!value) return null;
    if (/^\/(?:assets|images|audio)\//.test(value) && !value.includes('\\')) return value;
    if (/^\/api\/(?:media|audio)\/[a-f0-9]{64}$/.test(value)) return value;
    try {
        const address = new URL(value);
        return address.protocol === 'https:' && !address.username && !address.password ? address.href : null;
    } catch {
        return null;
    }
}

function mediaDropField(urlInput, currentUrl, config) {
    const hintId = 'upload-hint-' + ++uploadHintId;
    const error = el('p', { class: 'upload-drop__error', role: 'alert' });
    const preview = el('div', { class: 'upload-drop__preview', hidden: true });
    const input = el('input', {
        type: 'file', name: config.name, accept: config.types.join(','),
        class: 'upload-drop__input', 'aria-label': config.label, 'aria-describedby': hintId,
    });
    let file = null;
    let objectUrl = null;

    function clearSelection() {
        file = null;
        input.value = '';
        preview.hidden = true;
        preview.replaceChildren();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
    }

    function showPreview(src, caption, detail) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = src.startsWith('blob:') ? src : null;
        const visual = config.previewIcon
            ? el('span', { class: 'upload-drop__icon', 'aria-hidden': 'true' }, config.previewIcon)
            : el('img', { src, alt: '' });
        const remove = button('Убрать', event => {
            event.preventDefault();
            event.stopPropagation();
            clearSelection();
            urlInput.value = '';
            error.textContent = '';
        }, 'subtle compact', { type: 'button' });
        preview.replaceChildren(visual,
            el('span', {}, el('strong', {}, caption), el('small', {}, detail)), remove);
        preview.hidden = false;
    }

    function setFile(next) {
        error.textContent = '';
        if (!next) return;
        if (!config.types.includes(next.type)) {
            clearSelection();
            error.textContent = config.typeError;
            return;
        }
        if (next.size > config.limit) {
            clearSelection();
            error.textContent = config.sizeError;
            return;
        }
        file = next;
        showPreview(URL.createObjectURL(next), next.name, Math.max(1, Math.round(next.size / 1024)) + ' КБ');
    }

    input.addEventListener('change', () => {
        if (input.files?.length) setFile(input.files[0]);
    });
    const zone = el('label', { class: 'upload-drop' },
        input,
        el('span', { class: 'upload-drop__icon', 'aria-hidden': 'true' }, '＋'),
        el('span', { class: 'upload-drop__title' }, config.action),
        el('span', { class: 'upload-drop__hint', id: hintId }, config.hint),
        preview);
    zone.addEventListener('dragenter', event => { event.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragover', event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        zone.classList.add('is-over');
    });
    zone.addEventListener('dragleave', event => {
        if (!zone.contains(event.relatedTarget)) zone.classList.remove('is-over');
    });
    zone.addEventListener('drop', event => {
        event.preventDefault();
        zone.classList.remove('is-over');
        const dropped = [...(event.dataTransfer?.files ?? [])];
        const next = dropped.find(item => config.types.includes(item.type)) ?? dropped[0];
        if (next) setFile(next);
        else {
            clearSelection();
            error.textContent = config.dropError;
        }
    });
    const current = safeMedia(currentUrl);
    if (current) showPreview(current, config.currentCaption, 'Перетащите новое или уберите это');
    return {
        field: el('div', { class: 'field upload-field' },
            el('span', { class: 'field-label' }, config.label), zone, error),
        getFile: () => file,
        upload: async () => {
            if (!file) return null;
            if (!config.types.includes(file.type)) throw new Error(config.typeError);
            if (file.size > config.limit) throw new Error(config.sizeError);
            const uploaded = await request(config.endpoint, { method: 'POST', file });
            return uploaded[config.urlKey];
        },
    };
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
        const [catalog, stats] = await Promise.all([readPanelData('/admin/catalog'), readPanelData('/admin/stats')]);
        if (signal.aborted) return;
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
        const imageUrlField = textField('Адрес изображения', 'image_url', item?.image_url ?? '', { maxlength: 2048, placeholder: 'https://…' });
        const imageUpload = mediaDropField(imageUrlField.querySelector('input'), item?.image_url, imageMedia);
        const audioUrlField = textField('Аудио (ссылка)', 'audio_url', item?.audio_url ?? '', { maxlength: 2048 });
        const audioUpload = nominee ? mediaDropField(audioUrlField.querySelector('input'), item?.audio_url, audioMedia) : null;
        const form = el('form', { class: 'form-stack' },
            textField(nominee ? 'Имя' : 'Название', name, item?.[name] ?? '', { required: true, maxlength: 160 }),
            el('div', { class: 'form-grid' },
                nominee ? selectField('Номинация', 'nomination_id', validNominations.map(row => [row.id, row.title]), parent)
                    : selectField('Статус', 'status', Object.entries(nominationStatuses), item?.status ?? 'draft'),
                textField('Порядок отображения', 'sort_order', item?.sort_order ?? Math.min(lastOrder + 10, 2147483647),
                    { type: 'number', min: -2147483648, max: 2147483647, step: 1, required: true })),
            el('label', { class: 'field' }, 'Описание',
                el('textarea', { name: 'description', rows: 4, maxlength: 1200 }, item?.description ?? '')),
            imageUrlField,
            imageUpload.field,
            nominee ? el('div', { class: 'form-grid' },
                textField('Никнейм', 'handle', item?.handle ?? '', { maxlength: 100 }),
                textField('Ссылка на профиль (HTTPS)', 'link_url', item?.link_url ?? '', { maxlength: 2048 }),
                textField('Название трека', 'song', item?.song ?? '', { maxlength: 200 }),
                audioUrlField,
                textField('Описание изображения', 'image_alt', item?.image_alt ?? '', { maxlength: 300 })) : null,
            audioUpload ? audioUpload.field : null,
            audioUpload ? audioUpload.field : null,
            toggle('Убрать в архив', 'archived', !!item?.archived),
            formError(), el('div', { class: 'dialog-actions' }, submit(item ? 'Сохранить' : 'Создать')));
        bindForm(form, async fields => {
            const imageUrl = await imageUpload.upload() || fields.get('image_url').trim() || null;
            const payload = { [name]: fields.get(name).trim(), description: fields.get('description').trim(),
                image_url: imageUrl, sort_order: Number(fields.get('sort_order')), archived: fields.has('archived') };
            if (nominee) {
                payload.nomination_id = Number(fields.get('nomination_id'));
                for (const key of ['handle', 'song', 'image_alt', 'link_url']) payload[key] = fields.get(key).trim() || null;
                payload.audio_url = audioUpload ? await audioUpload.upload() || fields.get('audio_url').trim() || null
                    : fields.get('audio_url').trim() || null;
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
