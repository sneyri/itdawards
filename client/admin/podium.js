import { countUp, motionAllowed, reveal, tilt } from './motion.js';
import { button, el, numbers, request, selectField } from './ui.js';
import { readPanelUrl, updatePanelUrl } from './panel-url.js';
import { nomineeArt, nomineeDetails } from './nominee-media.js';

function groupResults(rows, nominees) {
    return [...Map.groupBy(rows.filter(row => !row.archived), row => row.nomination_id)]
        .map(([id, rows]) => {
            const sorted = [...rows].sort((a, b) => b.weighted_score - a.weighted_score);
            let place = 0;
            const total = sorted.reduce((sum, row) => sum + row.weighted_score, 0);
            return {
                id, title: sorted[0].title,
                entries: sorted.map((row, index) => {
                    if (row.weighted_score !== sorted[index - 1]?.weighted_score) place = index + 1;
                    return { ...nominees.get(row.id), ...row, place, share: total ? row.weighted_score / total : 0 };
                }),
            };
        });
}

const percent = new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 1 });
const score = value => numbers.format(value);
const winners = group => group.entries.filter(row => row.place <= 3 && row.weighted_score > 0);

function podiumCard(row, signal, withDetails) {
    const number = el('strong', { class: 'podium-score' }, score(row.weighted_score));
    const glare = el('span', { class: 'podium-glare', 'aria-hidden': 'true' });
    const art = nomineeArt(row, 'podium-art');
    const layer = el('div', { class: 'podium-layer' }, glare,
        el('span', { class: 'podium-rank' }, String(row.place).padStart(2, '0') + ' / МЕСТО'),
        art, el('h3', {}, row.name), row.handle ? el('p', { class: 'podium-handle' }, row.handle) : null,
        el('div', { class: 'podium-points' }, number, el('span', {}, 'баллы')),
        el('dl', { class: 'podium-stats' }, [
            ['Голоса', el('span', { class: 'podium-votes' }, score(row.vote_count))],
            ['Жюри', score(row.jury_votes)], ['Доля баллов', percent.format(row.share)],
        ].map(([label, value]) => el('div', {}, el('dt', {}, label), el('dd', {}, value)))),
        withDetails && button('Подробнее', () => nomineeDetails(row,
            el('a', { class: 'button primary', href: '#catalog?nomination=' + row.nomination_id + '&nominee=' + row.id,
                onClick: () => document.getElementById('dialog').close() }, 'Открыть в каталоге')), 'subtle compact',
        { 'aria-label': 'Подробнее · ' + row.name }));
    const card = el('article', { class: 'podium-card', 'data-place': row.place, 'data-nominee': row.id }, layer);
    tilt(card, layer, { glare, parallax: art.querySelector('img'), signal });
    return card;
}

function drawPodium(group, ranks, signal, { newRank, withDetails = false, prior } = {}) {
    const rows = winners(group).filter(row => ranks.includes(row.place)).sort((a, b) => b.place - a.place);
    if (!rows.length) return el('p', { class: 'empty' }, 'Пока нет баллов для пьедестала.');
    const cards = rows.map(row => podiumCard(row, signal, withDetails));
    const layout = el('div', { class: 'podium-grid', 'data-three': String(cards.length === 3 && ranks.length === 3) }, cards);
    const points = new Map(cards.map((card, index) => [card, rows[index].weighted_score]));
    const fresh = cards.filter(card => !prior?.has(card.dataset.nominee) && (newRank === undefined || Number(card.dataset.place) === newRank));
    reveal(fresh, {
        signal, interval: 190,
        onEnter: (card, delay) => countUp(card.querySelector('.podium-score'), points.get(card), { signal, format: score, delay }),
    });
    return layout;
}

const preliminary = () => el('p', { class: 'podium-preliminary' }, 'Промежуточные результаты');

function ceremony(groups, initial, isPreliminary, signal) {
    const session = new AbortController();
    let slide;
    let index = initial;
    let shown = 0;
    const title = el('h2', { id: 'ceremony-title' }, 'Церемония ITD Awards');
    const status = el('p', { class: 'podium-index', role: 'status' });
    const announcement = el('p', { class: 'ceremony-announcement', role: 'status' });
    const stage = el('div', { class: 'ceremony-stage' });
    const previous = button('← Номинация', () => navigate(-1), 'subtle');
    const next = button('Номинация →', () => navigate(1), 'subtle');
    const announce = button('Объявить место', revealPlace, 'primary');
    const close = button('Закрыть', () => dialog.close(), 'subtle', { autofocus: true });
    const dialog = el('dialog', { class: 'ceremony-dialog', 'aria-labelledby': title.id },
        el('header', { class: 'ceremony-header' }, title, close),
        stage, announcement, el('footer', { class: 'ceremony-controls' }, previous, announce, next));

    function draw() {
        slide?.abort();
        slide = new AbortController();
        const group = groups[index];
        const ranks = [...new Set(winners(group).map(row => row.place))].reverse();
        status.textContent = 'Номинация ' + (index + 1) + ' из ' + groups.length;
        previous.disabled = index === 0;
        next.disabled = index === groups.length - 1;
        announce.disabled = shown >= ranks.length;
        announce.textContent = announce.disabled ? 'Все места объявлены' : 'Объявить ' + ranks[shown] + '-е место';
        stage.replaceChildren(status, el('h3', {}, group.title), ...(isPreliminary ? [preliminary()] : []),
            shown ? drawPodium(group, ranks.slice(0, shown), slide.signal, { newRank: ranks[shown - 1] })
                : el('p', { class: 'ceremony-wait' }, ranks.length ? 'Нажмите пробел, чтобы объявить место.' : 'Пока нет результатов.'));
    }
    function navigate(direction) {
        const target = index + direction;
        if (target < 0 || target >= groups.length) return;
        index = target;
        shown = 0;
        draw();
        announcement.textContent = '';
        (announce.disabled ? close : announce).focus();
    }
    function revealPlace() {
        if (announce.disabled) return;
        const group = groups[index];
        const entries = winners(group);
        const rank = [...new Set(entries.map(row => row.place))].reverse()[shown];
        shown++;
        draw();
        announcement.textContent = rank + '-е место. ' + entries.filter(row => row.place === rank).map(row => row.name).join(', ');
        if (announce.disabled) (next.disabled ? close : next).focus();
    }
    function dispose() {
        session.abort();
        slide?.abort();
        dialog.remove();
    }
    dialog.addEventListener('close', dispose, { once: true });
    signal.addEventListener('abort', () => { dialog.close(); dispose(); }, { once: true, signal: session.signal });
    dialog.addEventListener('keydown', event => {
        if (['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
        if (event.repeat) return;
        if (event.key === 'ArrowLeft') navigate(-1);
        if (event.key === 'ArrowRight') navigate(1);
        if (event.key === ' ') revealPlace();
    }, { signal: session.signal });
    document.body.append(dialog);
    draw();
    dialog.showModal();
}

export function resultsPodium(rows, { signal, isPreliminary, catalog = [], allowCeremony = false, onResults }) {
    const nominees = new Map(catalog.flatMap(category => category.nominees.map(nominee => [nominee.id, nominee])));
    let groups = groupResults(rows, nominees);
    if (!groups.length) return el('p', { class: 'empty' }, 'Нет данных по номинантам.');
    const initial = Number(readPanelUrl().params.get('nomination'));
    const selected = groups.findIndex(group => group.id === initial);
    let index = selected >= 0 ? selected : Math.max(0, groups.findIndex(group => winners(group).length));
    let renderScope;
    const region = el('div', { class: 'podium-region' });
    const picker = selectField('Номинация', 'podium-nomination',
        groups.map(group => [String(group.id), group.title]), String(groups[index].id));
    const select = picker.querySelector('select');
    const feedback = el('p', { class: 'podium-feedback', role: 'status' });
    const replay = button('Переиграть', () => draw(), 'subtle');
    const refresh = button('Обновить результаты', refreshResults, 'subtle');
    const start = allowCeremony ? button('Режим церемонии', () => ceremony(groups, index, isPreliminary, signal), 'primary') : null;
    const result = el('div', { class: 'results-podium' },
        el('div', { class: 'podium-toolbar' }, picker, replay, refresh, start),
        isPreliminary ? preliminary() : null, feedback, region);
    signal.addEventListener('abort', () => renderScope?.abort(), { once: true });
    select.addEventListener('change', () => {
        index = groups.findIndex(group => String(group.id) === select.value);
        updatePanelUrl({ nomination: select.value });
        draw();
    }, { signal });
    async function refreshResults() {
        refresh.disabled = true;
        feedback.textContent = 'Запрашиваем результаты…';
        try {
            const snapshot = await request('/admin/results', { signal });
            if (signal.aborted) return;
            const next = groupResults(snapshot, nominees);
            onResults?.(snapshot);
            if (!next.length) {
                feedback.textContent = 'Пока нет данных по номинантам.';
                region.replaceChildren();
                replay.disabled = true;
                if (start) start.disabled = true;
                return;
            }
            const id = groups[index].id;
            groups = next;
            const optionsChanged = groups.map(group => String(group.id) + group.title).join('\n')
                !== [...select.options].map(option => option.value + option.textContent).join('\n');
            if (optionsChanged) {
                // The wrapper builds its options once. Remount the section to refresh its catalog and picker.
                document.getElementById('refresh-panel').click();
                return;
            }
            index = groups.findIndex(group => group.id === id);
            if (start) start.disabled = false;
            feedback.textContent = 'Результаты обновлены.';
            draw(true);
        } catch (error) {
            if (!signal.aborted) feedback.textContent = error.message;
        } finally {
            if (!signal.aborted) refresh.disabled = false;
        }
    }
    function draw(reorder = false) {
        const prior = reorder && motionAllowed() ? new Map([...region.querySelectorAll('.podium-card')].map(card =>
            [card.dataset.nominee, { rect: card.getBoundingClientRect(),
                score: Number(card.dataset.score), votes: Number(card.dataset.votes) }])) : undefined;
        renderScope?.abort();
        renderScope = new AbortController();
        const group = groups[index];
        const top = new Set(winners(group));
        const others = group.entries.filter(row => !top.has(row));
        const first = group.entries[0];
        const runner = group.entries[1];
        const gap = runner && first.weighted_score > runner.weighted_score ? first.weighted_score - runner.weighted_score : 0;
        replay.disabled = !top.size;
        region.replaceChildren(drawPodium(group, [...new Set([...top].map(row => row.place))], renderScope.signal, { withDetails: true, prior }),
            runner && first.weighted_score > 0 ? el('div', { class: 'ranking-gap' },
                el('span', {}, gap ? 'Отрыв лидера' : 'Первое место разделено'),
                gap ? el('strong', {}, '+' + score(gap) + ' б.') : null,
                el('meter', { min: 0, max: first.weighted_score, value: gap, 'aria-label': 'Отрыв лидера относительно его баллов' })) : '',
            others.length ? el('ol', { class: 'podium-others', 'aria-label': 'Остальные номинанты' }, others.map(row =>
                el('li', {}, el('span', { class: 'mono' }, row.weighted_score ? row.place + '.' : '—'),
                    el('strong', {}, row.name), el('span', { class: 'mono' }, score(row.weighted_score) + ' балл.')))) : '');
        for (const card of region.querySelectorAll('.podium-card')) {
            const current = group.entries.find(row => String(row.id) === card.dataset.nominee);
            card.dataset.score = current.weighted_score;
            card.dataset.votes = current.vote_count;
            const before = prior?.get(card.dataset.nominee);
            if (!before) continue;
            const after = card.getBoundingClientRect();
            const movement = card.animate([
                { transform: `translate(${before.rect.left - after.left}px,${before.rect.top - after.top}px)` },
                { transform: 'translate(0,0)' },
            ], { duration: 630, easing: 'cubic-bezier(.16,1,.3,1)' });
            renderScope.signal.addEventListener('abort', () => movement.cancel(), { once: true });
            countUp(card.querySelector('.podium-score'), current.weighted_score, { signal: renderScope.signal, from: before.score, format: score });
            countUp(card.querySelector('.podium-votes'), current.vote_count, { signal: renderScope.signal, from: before.votes, format: score });
        }
    }
    draw();
    return result;
}
