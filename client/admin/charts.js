import { el, numbers } from './ui.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function surface(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const { width, height } = canvas.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
}

const seriesLabels = { votes: 'Голоса', active_users: 'Активные голосующие', registrations: 'Регистрации' };
const day = value => String(value).slice(0, 10).split('-').reverse().slice(0, 2).join('.');

export function activityChart(trends, signal) {
    if (!trends.length) return el('p', { class: 'empty' }, 'Нет данных по дням.');
    let series = 'votes';
    let selected = trends.length - 1;
    let animation = 0;
    let chartSize = 0;
    const canvas = el('canvas', { 'aria-hidden': 'true' });
    const details = el('div', { class: 'chart-readout', 'aria-live': 'polite' });
    const previous = el('button', { class: 'button subtle compact', type: 'button', 'aria-label': 'Предыдущий день' }, '‹');
    const next = el('button', { class: 'button subtle compact', type: 'button', 'aria-label': 'Следующий день' }, '›');
    const tabs = Object.entries(seriesLabels).map(([key, name]) => el('button', {
        class: 'chip compact', type: 'button', 'aria-pressed': String(key === series),
        onClick: event => {
            series = key;
            tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab === event.currentTarget)));
            update();
            animate();
        },
    }, name));

    function draw(fraction) {
        const frame = surface(canvas);
        if (!frame) return;
        const { ctx, width, height } = frame;
        chartSize = width;
        const appearance = getComputedStyle(document.documentElement);
        const ink = appearance.getPropertyValue('--ink').trim() || '237,176,90';
        const muted = appearance.getPropertyValue('--muted').trim();
        const left = 31;
        const top = 17;
        const bottom = height - 26;
        const span = width - left - 9;
        const max = Math.max(1, ...trends.map(entry => entry[series]));
        const scaleMax = Math.max(4, Math.ceil(max / 4) * 4);
        const point = (index, value) => [left + span * index / Math.max(1, trends.length - 1),
            bottom - (bottom - top) * value * fraction / scaleMax];
        ctx.font = '11px system-ui';
        for (let i = 0; i <= 4; i++) {
            const y = bottom - (bottom - top) * i / 4;
            ctx.strokeStyle = 'rgba(' + ink + ',.22)';
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(width - 9, y);
            ctx.stroke();
            ctx.fillStyle = muted;
            ctx.fillText(numbers.format(scaleMax * i / 4), 1, y + 3);
        }
        const points = trends.map((entry, index) => point(index, entry[series]));
        ctx.beginPath();
        points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.lineTo(points.at(-1)[0], bottom);
        ctx.lineTo(left, bottom);
        ctx.closePath();
        const fill = ctx.createLinearGradient(0, top, 0, bottom);
        fill.addColorStop(0, 'rgba(' + ink + ',.42)');
        fill.addColorStop(1, 'rgba(' + ink + ',.028)');
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.beginPath();
        points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.strokeStyle = 'rgba(' + ink + ',.95)';
        ctx.lineWidth = 2;
        ctx.stroke();
        const [x, y] = points[selected];
        ctx.beginPath();
        ctx.arc(x, y, 3.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + ink + ',1)';
        ctx.fill();
        ctx.fillStyle = muted;
        ctx.fillText(day(trends[0].day), left, height - 7);
        ctx.textAlign = 'right';
        ctx.fillText(day(trends.at(-1).day), width - 9, height - 7);
        ctx.textAlign = 'left';
    }

    function animate() {
        cancelAnimationFrame(animation);
        const started = performance.now();
        function step(now) {
            if (signal?.aborted || !canvas.isConnected) return;
            const still = reducedMotion.matches || document.hidden || document.body.classList.contains('effects-off');
            const fraction = still ? 1 : Math.min(1, (now - started) / 420);
            draw(1 - (1 - fraction) ** 3);
            if (fraction < 1) animation = requestAnimationFrame(step);
        }
        animation = requestAnimationFrame(step);
    }

    function update() {
        details.textContent = day(trends[selected].day) + ' UTC · ' + seriesLabels[series] + ': ' + numbers.format(trends[selected][series]);
        previous.disabled = selected === 0;
        next.disabled = selected === trends.length - 1;
    }

    function choose(index) {
        if (index === selected) return;
        selected = Math.max(0, Math.min(trends.length - 1, index));
        update();
        draw(1);
    }

    previous.addEventListener('click', () => choose(selected - 1));
    next.addEventListener('click', () => choose(selected + 1));
    canvas.addEventListener('pointermove', event => {
        if (!chartSize) return;
        const offset = event.clientX - canvas.getBoundingClientRect().left;
        choose(Math.round((offset - 31) / (chartSize - 40) * (trends.length - 1)));
    });
    const layout = el('div', {}, el('div', { class: 'toolbar' }, tabs),
        el('div', { class: 'chart-wrap' }, canvas),
        el('div', { class: 'toolbar' }, previous, next, details));
    const resize = new ResizeObserver(() => {
        if (canvas.isConnected && canvas.clientWidth) draw(1);
    });
    resize.observe(canvas);
    signal?.addEventListener('abort', () => { cancelAnimationFrame(animation); resize.disconnect(); }, { once: true });
    update();
    animate();
    return layout;
}
