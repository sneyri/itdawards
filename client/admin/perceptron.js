import { motionAllowed } from './motion.js';

export function startPerceptron(signal) {
    if (signal.aborted) return;
    const narrow = matchMedia('(max-width: 900px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const canvas = document.createElement('canvas');
    canvas.className = 'admin-perceptron';
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    if (!context) return;
    const layers = [12, 16, 12].map((size, depth) => Array.from({ length: size }, (_, index) => ({
        x: .16 + depth * .34 + Math.sin(index * 3.7 + depth) * .075,
        y: .08 + (index / (size - 1)) * .84,
    })));
    const edges = layers.slice(0, -1).flatMap((layer, depth) => layer.flatMap((node, index) => {
        const following = layers[depth + 1];
        const neighbor = Math.round(index / (layer.length - 1) * (following.length - 1));
        return [{ from: node, to: following[neighbor] },
            { from: node, to: following[(neighbor + 1) % following.length] }];
    }));
    const nodes = layers.flat();
    let width;
    let height;
    let frame;
    let previous = 0;
    let slowFrames = 0;
    let disabled = false;

    function size() {
        width = innerWidth;
        height = innerHeight;
        const scale = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        context.setTransform(scale, 0, 0, scale, 0, 0);
    }
    function draw(now) {
        if (previous && now - previous > 25) slowFrames++;
        else slowFrames = Math.max(0, slowFrames - 1);
        if (slowFrames >= 24) {
            disabled = true;
            frame = undefined;
            sync();
            return;
        }
        previous = now;
        context.clearRect(0, 0, width, height);
        context.beginPath();
        for (const { from, to } of edges) {
            context.moveTo(from.x * width, from.y * height);
            context.lineTo(to.x * width, to.y * height);
        }
        context.strokeStyle = 'rgba(205,181,124,.25)';
        context.stroke();
        context.beginPath();
        for (const node of nodes) {
            const x = node.x * width;
            const y = node.y * height;
            context.moveTo(x + 1.4, y);
            context.arc(x, y, 1.4, 0, Math.PI * 2);
        }
        context.fillStyle = 'rgba(238,209,145,.5)';
        context.fill();
        context.beginPath();
        for (const [index, { from, to }] of edges.entries()) {
            if (index % 5 !== 0) continue;
            const progress = (now / 4400 + index * .117) % 1;
            const x = (from.x + (to.x - from.x) * progress) * width;
            const y = (from.y + (to.y - from.y) * progress) * height;
            context.moveTo(x + 2.1, y);
            context.arc(x, y, 2.1, 0, Math.PI * 2);
        }
        context.fillStyle = 'rgba(246,221,166,.82)';
        context.fill();
        frame = requestAnimationFrame(draw);
    }
    function sync() {
        const section = document.getElementById('view').dataset.section;
        const active = !disabled && !signal.aborted && !narrow.matches && motionAllowed()
            && section !== 'overview';
        if (active && frame === undefined) {
            if (!canvas.isConnected) document.body.prepend(canvas);
            size();
            previous = 0;
            slowFrames = 0;
            frame = requestAnimationFrame(draw);
        } else if (!active) {
            cancelAnimationFrame(frame);
            frame = undefined;
            canvas.remove();
        }
    }
    const options = { signal };
    narrow.addEventListener('change', sync, options);
    reduced.addEventListener('change', sync, options);
    document.addEventListener('admin:effects', sync, options);
    document.addEventListener('visibilitychange', sync, options);
    window.addEventListener('resize', () => { if (frame !== undefined) size(); }, options);
    window.addEventListener('hashchange', sync, options);
    signal.addEventListener('abort', sync, { once: true });
    sync();
}
