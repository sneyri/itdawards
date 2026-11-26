import { el } from './dom.js';
import { motionAllowed } from './motion.js';

const groups = '#navigation, .admin-security-tabs, .nominee-view, .chart-tabs';
const current = '[aria-current="page"], [aria-pressed="true"]';
const tables = '.table-frame';
const buttonSelector = '.button:not(.command-item,.search-clear), .chip';

export function installKitInteractions(signal) {
    let glow;
    let pointer;
    let pointerFrame;
    let layoutFrame;
    const observed = new WeakSet();
    const positions = new Map();
    const indicators = new Set();
    const tableObserver = new IntersectionObserver(entries => {
        for (const { target, isIntersecting } of entries) {
            if (!isIntersecting) continue;
            tableObserver.unobserve(target);
            [...target.querySelectorAll('tbody tr')].slice(0, 10).forEach((row, index) => {
                row.style.setProperty('--kit-step', index);
                row.dataset.kitRow = '';
            });
        }
    });
    function placeIndicators() {
        layoutFrame = undefined;
        const visible = new Set();
        for (const indicator of indicators) {
            if (!indicator.isConnected) indicators.delete(indicator);
        }
        for (const group of document.querySelectorAll(groups)) {
            const selected = group.querySelector(current);
            if (!selected?.offsetWidth) continue;
            const key = group.id || [...group.classList].find(name => ['admin-security-tabs', 'nominee-view', 'chart-tabs'].includes(name));
            visible.add(key);
            let indicator = group.querySelector(':scope > .kit-shared-indicator');
            if (!indicator) {
                indicator = el('span', { class: 'kit-shared-indicator kit-indicator', 'aria-hidden': 'true' });
                group.prepend(indicator);
                indicators.add(indicator);
            }
            const placement = {
                x: selected.offsetLeft, y: selected.offsetTop, width: selected.offsetWidth, height: selected.offsetHeight,
            };
            const last = positions.get(key);
            if (last && last.node === indicator && last.selected === selected
                && ['x', 'y', 'width', 'height'].every(prop => last[prop] === placement[prop])) continue;
            const position = 'translate(' + placement.x + 'px,' + placement.y + 'px)';
            indicator.getAnimations().forEach(animation => animation.cancel());
            indicator.style.width = placement.width + 'px';
            indicator.style.height = placement.height + 'px';
            indicator.style.transform = position;
            indicator.dataset.ready = '';
            if (last && last.selected !== selected && motionAllowed()) {
                const style = getComputedStyle(group);
                indicator.animate([
                    { transform: `translate(${last.x}px,${last.y}px) scale(${last.width / placement.width},${last.height / placement.height})` },
                    { transform: position },
                ], { duration: parseFloat(style.getPropertyValue('--kit-time')), easing: style.getPropertyValue('--kit-ease').trim() });
            }
            positions.set(key, { ...placement, node: indicator, selected });
        }
        for (const key of positions.keys()) if (!visible.has(key)) positions.delete(key);
    }
    function scheduleLayout() {
        if (layoutFrame === undefined) layoutFrame = requestAnimationFrame(placeIndicators);
    }
    function observeTables(node) {
        if (!(node instanceof Element)) return;
        const candidates = node.matches(tables) ? [node] : node.querySelectorAll(tables);
        for (const table of candidates) {
            if (observed.has(table)) continue;
            observed.add(table);
            tableObserver.observe(table);
        }
    }
    const observer = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) observeTables(node);
            for (const node of record.removedNodes) {
                if (!(node instanceof Element) || node.isConnected) continue;
                if (node.matches(tables)) tableObserver.unobserve(node);
                node.querySelectorAll(tables).forEach(table => tableObserver.unobserve(table));
            }
        }
        scheduleLayout();
    });
    for (const target of ['view', 'navigation', 'dialog']) {
        observer.observe(document.getElementById(target), {
            childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current', 'aria-pressed'],
        });
    }
    observeTables(document.getElementById('view'));
    window.addEventListener('resize', scheduleLayout, { signal });
    void document.fonts.ready.then(() => { if (!signal.aborted) scheduleLayout(); });
    document.addEventListener('pointermove', event => {
        if (!motionAllowed() || event.pointerType === 'touch' || !(event.target instanceof Element)) return;
        pointer = event;
        if (pointerFrame !== undefined) return;
        pointerFrame = requestAnimationFrame(() => {
            pointerFrame = undefined;
            const panel = pointer.target.closest('.panel:not(.empty)');
            if (glow !== panel) glow?.removeAttribute('data-lit');
            glow = panel;
            if (!glow?.isConnected) return;
            const bounds = glow.getBoundingClientRect();
            glow.style.setProperty('--light-x', pointer.clientX - bounds.left + 'px');
            glow.style.setProperty('--light-y', pointer.clientY - bounds.top + 'px');
            glow.dataset.lit = '';
        });
    }, { signal });
    document.documentElement.addEventListener('pointerleave', () => {
        cancelAnimationFrame(pointerFrame);
        pointerFrame = undefined;
        glow?.removeAttribute('data-lit');
    }, { signal });
    document.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        const control = event.target.closest('a.nav-link, button[aria-pressed]');
        const group = control?.parentElement;
        if (!group?.matches(groups)) return;
        const choices = [...group.children].filter(item => item.matches('a.nav-link, button[aria-pressed]:not(:disabled)'));
        const index = choices.indexOf(control);
        const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
        const destination = choices[event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1
            : (index + (back ? -1 : 1) + choices.length) % choices.length];
        if (!destination) return;
        event.preventDefault();
        destination.focus();
    }, { signal });
    document.addEventListener('click', event => {
        const control = event.target.closest(buttonSelector);
        if (!control || control.disabled || !control.isConnected || !motionAllowed()) return;
        const bounds = control.getBoundingClientRect();
        const wave = el('span', { class: 'kit-wave', 'aria-hidden': 'true' });
        wave.style.left = (event.detail ? event.clientX - bounds.left : bounds.width / 2) + 'px';
        wave.style.top = (event.detail ? event.clientY - bounds.top : bounds.height / 2) + 'px';
        control.append(wave);
        wave.addEventListener('animationend', () => wave.remove(), { once: true });
        wave.addEventListener('animationcancel', () => wave.remove(), { once: true });
    }, { signal });
    function stopMotion() {
        if (motionAllowed()) return;
        glow?.removeAttribute('data-lit');
        cancelAnimationFrame(pointerFrame);
        pointerFrame = undefined;
        for (const indicator of indicators) indicator.getAnimations().forEach(animation => animation.cancel());
    }
    document.addEventListener('admin:effects', stopMotion, { signal });
    document.addEventListener('visibilitychange', stopMotion, { signal });
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', stopMotion, { signal });
    signal.addEventListener('abort', () => {
        observer.disconnect();
        tableObserver.disconnect();
        cancelAnimationFrame(layoutFrame);
        cancelAnimationFrame(pointerFrame);
    }, { once: true });
    scheduleLayout();
}
