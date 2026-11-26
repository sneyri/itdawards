const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const mouse = matchMedia('(any-hover: hover) and (any-pointer: fine)');
const duration = { reveal: 420, count: 720, type: 560 };
const easing = 'cubic-bezier(.18,.8,.25,1)';
const stagger = 65;

export function motionAllowed() {
    return !reduced.matches && !document.hidden && !document.body.classList.contains('effects-off');
}

function watchMotion(stop, signal) {
    const check = () => { if (!motionAllowed()) stop(); };
    reduced.addEventListener('change', check, { signal });
    document.addEventListener('visibilitychange', check, { signal });
    document.addEventListener('admin:effects', check, { signal });
}

export function reveal(elements, { signal, interval = stagger, onEnter } = {}) {
    if (signal?.aborted || !motionAllowed() || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
    const lifecycle = new AbortController();
    const waiting = new Set();
    const playing = new Set();
    const observer = new IntersectionObserver(entries => {
        let index = 0;
        for (const { target, isIntersecting } of entries) {
            if (!isIntersecting || !waiting.has(target)) continue;
            observer.unobserve(target);
            waiting.delete(target);
            const delay = index++ * interval;
            const animation = target.animate([
                { opacity: 0, transform: 'translateY(10px)' },
                { opacity: 1, transform: 'translateY(0)' },
            ], { delay, duration: duration.reveal, easing, fill: 'backwards' });
            target.removeAttribute('data-motion-pending');
            playing.add(animation);
            onEnter?.(target, delay);
            animation.addEventListener('finish', () => {
                playing.delete(animation);
                if (!waiting.size && !playing.size) stop();
            }, { once: true });
        }
    });
    function stop() {
        lifecycle.abort();
        observer.disconnect();
        for (const element of waiting) element.removeAttribute('data-motion-pending');
        waiting.clear();
        for (const animation of playing) animation.cancel();
        playing.clear();
    }
    signal?.addEventListener('abort', stop, { once: true, signal: lifecycle.signal });
    watchMotion(stop, lifecycle.signal);
    for (const element of elements) {
        waiting.add(element);
        element.setAttribute('data-motion-pending', '');
        element.addEventListener('focusin', stop, { once: true, signal: lifecycle.signal });
        observer.observe(element);
    }
    if (!waiting.size) stop();
}

function animateText(element, final, draw, length, signal, delay = 0) {
    element.textContent = final;
    if (!motionAllowed() || signal?.aborted || !length) return () => {};
    const lifecycle = new AbortController();
    const reference = document.createElement('span');
    const visual = document.createElement('span');
    reference.className = 'motion-text__reference';
    reference.textContent = final;
    visual.className = 'motion-text__visual';
    visual.setAttribute('aria-hidden', 'true');
    element.classList.add('motion-text');
    element.replaceChildren(reference, visual);
    const start = performance.now() + delay;
    let frame;
    function stop() {
        lifecycle.abort();
        cancelAnimationFrame(frame);
        element.classList.remove('motion-text');
        element.textContent = final;
    }
    function step(now) {
        const progress = Math.min(1, (now - start) / length);
        if (progress === 1) stop();
        else {
            const text = draw(Math.max(0, progress));
            if (visual.textContent !== text) visual.textContent = text;
            frame = requestAnimationFrame(step);
        }
    }
    visual.textContent = draw(0);
    frame = requestAnimationFrame(step);
    signal?.addEventListener('abort', stop, { once: true, signal: lifecycle.signal });
    watchMotion(stop, lifecycle.signal);
    return stop;
}

export function countUp(element, value, { signal, from = 0, format = String, delay = 0 } = {}) {
    return animateText(element, format(value), progress =>
        format(Math.round(from + (value - from) * (1 - (1 - progress) ** 3))),
    value === from ? 0 : duration.count, signal, delay);
}

export function typeText(element, value, { signal } = {}) {
    const characters = Array.from(value);
    return animateText(element, value, progress => characters.slice(0, Math.ceil(progress * characters.length)).join(''),
        Math.min(duration.type, characters.length * 38), signal);
}

// Listen on the stable card and transform its inner layer so pointer coordinates don't shift.
export function tilt(surface, layer, { glare, parallax, signal } = {}) {
    if (signal?.aborted) return;
    const lifecycle = new AbortController();
    const listeners = { signal: lifecycle.signal };
    let frame;
    let position;
    function reset(smooth = false) {
        cancelAnimationFrame(frame);
        frame = undefined;
        position = undefined;
        layer.classList.toggle('motion-tilt-return', smooth);
        layer.style.removeProperty('transform');
        parallax?.style.removeProperty('transform');
        if (glare) {
            glare.style.removeProperty('transform');
            glare.style.removeProperty('opacity');
        }
    }
    function apply() {
        frame = undefined;
        const { left, top, width, height } = surface.getBoundingClientRect();
        if (!width || !height) return;
        const bound = value => Math.min(1, Math.max(0, value));
        const x = bound((position.clientX - left) / width);
        const y = bound((position.clientY - top) / height);
        layer.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 22}deg) rotateY(${(x - 0.5) * 22}deg) rotateZ(${(x - .5) * (y - .5) * 5}deg)`;
        if (parallax) parallax.style.transform = `translate3d(${(x - .5) * -13}px,${(y - .5) * -13}px,0) scale(1.08)`;
        if (glare) {
            glare.style.transform = `translate(${(x - 0.5) * width}px, ${(y - 0.5) * height}px)`;
            glare.style.opacity = '1';
        }
    }
    surface.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch' || !mouse.matches || !motionAllowed()) return;
        position = event;
        layer.classList.remove('motion-tilt-return');
        if (frame === undefined) frame = requestAnimationFrame(apply);
    }, listeners);
    surface.addEventListener('pointerleave', () => reset(motionAllowed()), listeners);
    mouse.addEventListener('change', () => { if (!mouse.matches) reset(); }, listeners);
    watchMotion(reset, lifecycle.signal);
    signal?.addEventListener('abort', () => { lifecycle.abort(); reset(); }, { once: true, signal: lifecycle.signal });
}
