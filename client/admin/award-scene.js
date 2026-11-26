import { motionAllowed } from './motion.js';

function seededRandom() {
    let seed = 2026;
    return () => {
        seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}

function buildScene(T) {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(36, 1, .1, 50);
    const rig = new T.Group();
    const crystal = new T.Group();
    const random = seededRandom();
    scene.add(rig);
    rig.add(crystal);
    const coreGeometry = new T.IcosahedronGeometry(.91, 0);
    const shell = new T.Mesh(coreGeometry, new T.MeshPhysicalMaterial({
        color: 0xa88448, metalness: .68, roughness: .26, clearcoat: .75,
        emissive: 0x563419, emissiveIntensity: .18, flatShading: true,
    }));
    shell.scale.set(.79, 1.42, .86);
    crystal.add(shell);
    const skeleton = new T.LineSegments(new T.WireframeGeometry(coreGeometry),
        new T.LineBasicMaterial({ color: 0xf4c377, transparent: true, opacity: .6 }));
    skeleton.scale.copy(shell.scale).multiplyScalar(1.006);
    crystal.add(skeleton);

    const facetGeometry = new T.IcosahedronGeometry(.16, 0);
    const facets = new T.InstancedMesh(facetGeometry,
        new T.MeshPhysicalMaterial({ color: 0xe2b76d, roughness: .22, metalness: .58, flatShading: true }), 13);
    const dummy = new T.Object3D();
    const spokes = [];
    for (let index = 0; index < facets.count; index++) {
        const angle = index * 2.39996;
        const radius = 1.04 + random() * .57;
        dummy.position.set(Math.cos(angle) * radius, (random() - .5) * 2.55, Math.sin(angle) * radius);
        dummy.rotation.set(angle * .21, angle * .87, angle * .51);
        dummy.scale.set(.3 + random() * .65, .8 + random() * 1.9, .55);
        dummy.updateMatrix();
        facets.setMatrixAt(index, dummy.matrix);
        if (index % 2 === 0) spokes.push(...dummy.position.toArray(), 0, dummy.position.y * .42, 0);
    }
    crystal.add(facets, new T.LineSegments(
        new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(spokes, 3)),
        new T.LineBasicMaterial({ color: 0xd7aa65, opacity: .19, transparent: true }),
    ));

    const tracks = new T.Group();
    rig.add(tracks);
    const colors = [0xf2b964, 0x689a9e, 0x8c6a46, 0xd9a854];
    for (let ring = 0; ring < colors.length; ring++) {
        const radius = 1.4 + ring * .29;
        const points = Array.from({ length: 105 }, (_, index) => {
            const angle = index / 104 * Math.PI * (ring % 2 ? 1.6 : 1.94);
            return new T.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        });
        const line = new T.Line(new T.BufferGeometry().setFromPoints(points),
            new T.LineBasicMaterial({ color: colors[ring], transparent: true, opacity: ring ? .43 : .68 }));
        line.rotation.x = [.04, .66, -.63, .29][ring];
        line.rotation.z = [.16, -.36, -.49, .55][ring];
        line.position.y = (ring - 1.5) * .24;
        tracks.add(line);
    }
    const ticks = [];
    for (let index = 0; index < 84; index++) {
        const angle = index * Math.PI * 2 / 84;
        const end = index % 7 === 0 ? 2.45 : 2.32;
        ticks.push(Math.cos(angle) * 2.23, -1.05, Math.sin(angle) * 2.23,
            Math.cos(angle) * end, -1.05, Math.sin(angle) * end);
    }
    rig.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(ticks, 3)),
        new T.LineBasicMaterial({ color: 0xbfb093, transparent: true, opacity: .32 })));

    const cloud = [];
    const seeds = [];
    for (let index = 0; index < 480; index++) {
        const radius = 1.05 + random() ** .65 * 2.35;
        const angle = random() * Math.PI * 2;
        cloud.push(Math.cos(angle) * radius, (random() - .5) * 2.8, Math.sin(angle) * radius);
        seeds.push(random());
    }
    const cloudGeometry = new T.BufferGeometry();
    cloudGeometry.setAttribute('position', new T.Float32BufferAttribute(cloud, 3));
    cloudGeometry.setAttribute('seed', new T.Float32BufferAttribute(seeds, 1));
    const uniforms = { time: { value: 0 }, impulse: { value: 0 }, density: { value: 1 } };
    const particles = new T.Points(cloudGeometry, new T.ShaderMaterial({
        uniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: `
            attribute float seed;
            uniform float time;
            uniform float impulse;
            uniform float density;
            varying float intensity;
            varying float tone;
            void main() {
                vec3 p = position * (1.0 + impulse * 0.11);
                p.y += sin(time * 0.9 + seed * 21.0) * 0.13;
                vec4 transformed = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * transformed;
                intensity = 0.3 + 0.65 * pow(0.5 + 0.5 * sin(time * 2.1 + seed * 38.0), 2.0);
                tone = seed;
                gl_PointSize = (7.5 + seed * 8.0 + impulse * 11.0) * density / max(2.0, -transformed.z);
            }
        `,
        fragmentShader: `
            varying float intensity;
            varying float tone;
            void main() {
                float falloff = 1.0 - smoothstep(0.01, 0.49, length(gl_PointCoord - vec2(0.5)));
                vec3 color = mix(vec3(0.47, 0.73, 0.74), vec3(1.0, 0.69, 0.36), smoothstep(0.1, 0.6, tone));
                gl_FragColor = vec4(color, intensity * falloff * falloff);
            }
        `,
    }));
    rig.add(particles);
    scene.add(new T.AmbientLight(0xe4d3b9, 1.4));
    const warm = new T.PointLight(0xffc882, 55, 15, 2);
    const cool = new T.PointLight(0x83c9d6, 29, 13, 2);
    warm.position.set(1.5, 2.8, 3.1);
    cool.position.set(-2.2, .2, -1.8);
    scene.add(warm, cool);
    return { scene, camera, rig, crystal, tracks, particles, uniforms, warm, shell };
}

export function prepareAwardScene(host, signal) {
    if (signal.aborted || !('IntersectionObserver' in window) || !('ResizeObserver' in window)) return;
    const viewport = matchMedia('(min-width: 901px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const lifecycle = new AbortController();
    const listeners = { signal: lifecycle.signal };
    let renderer;
    let model;
    let frame;
    let loading = false;
    let visible = false;
    let pixelRatio = 1;
    let slow = 0;
    let quality = 2;
    let clock = 0;
    let previous = 0;
    let impulse = 0;
    let seenVotes;
    const pointer = { x: 0, y: 0 };
    const canRun = () => !lifecycle.signal.aborted && visible && viewport.matches && motionAllowed() && !navigator.connection?.saveData;

    const observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        void sync();
    }, { rootMargin: '0px' });
    const resize = new ResizeObserver(() => fit());
    function fit() {
        if (!renderer) return;
        const { width, height } = host.getBoundingClientRect();
        if (!width || !height) return;
        pixelRatio = quality === 2 ? Math.min(1.5, devicePixelRatio) : quality === 1 ? 1 : .7;
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        model.camera.aspect = width / height;
        model.camera.updateProjectionMatrix();
        model.uniforms.density.value = pixelRatio;
        model.particles.geometry.setDrawRange(0, quality === 2 ? 480 : quality === 1 ? 260 : 125);
    }
    function render(now) {
        frame = undefined;
        if (!canRun()) return;
        const elapsed = previous ? now - previous : 16;
        previous = now;
        clock += Math.min(45, elapsed) / 1000;
        slow = elapsed > 26 ? slow + 1 : Math.max(0, slow - 2);
        if (slow >= 30 && quality > 0) {
            quality--;
            slow = 0;
            fit();
        }
        const { rig, camera, crystal, tracks, uniforms, warm, shell } = model;
        const ease = 1 - Math.exp(-elapsed * .003);
        camera.position.x += (pointer.x * .8 - camera.position.x) * ease;
        camera.position.y += (.75 - pointer.y * .5 - camera.position.y) * ease;
        camera.position.z = 6.25;
        camera.lookAt(0, .04, 0);
        rig.rotation.y = clock * .084;
        crystal.rotation.y = clock * -.15;
        crystal.rotation.z = .12 + Math.sin(clock * .41) * .13;
        crystal.position.y = Math.sin(clock * .88) * .09;
        tracks.rotation.y = clock * .033;
        impulse *= Math.exp(-elapsed * .0016);
        uniforms.time.value = clock;
        uniforms.impulse.value = impulse;
        warm.intensity = 52 + impulse * 49;
        warm.position.x = 2.1 * Math.cos(clock * .52);
        shell.material.emissiveIntensity = .22 + impulse * .5;
        renderer.render(model.scene, camera);
        frame = requestAnimationFrame(render);
    }
    async function sync() {
        if (!canRun()) {
            cancelAnimationFrame(frame);
            frame = undefined;
            previous = 0;
            if (!viewport.matches || reduced.matches || document.body.classList.contains('effects-off')) {
                host.removeAttribute('data-scene-live');
            }
            return;
        }
        if (!renderer && !loading) {
            loading = true;
            const canvas = document.createElement('canvas');
            const attributes = { alpha: true, antialias: false, powerPreference: 'low-power' };
            const context = canvas.getContext('webgl2', attributes);
            if (!context) return;
            try {
                const T = await import('/assets/admin-engine/r186/three.min.js');
                if (!canRun()) { context.getExtension('WEBGL_lose_context')?.loseContext(); loading = false; return; }
                renderer = new T.WebGLRenderer({ canvas, context, ...attributes });
                model = buildScene(T);
                host.append(canvas);
                canvas.addEventListener('webglcontextlost', dispose, listeners);
                fit();
            } catch {
                if (!renderer) context.getExtension('WEBGL_lose_context')?.loseContext();
                dispose();
                return;
            }
        }
        if (!renderer || frame !== undefined) return;
        host.setAttribute('data-scene-live', '');
        frame = requestAnimationFrame(render);
    }
    function dispose() {
        lifecycle.abort();
        observer.disconnect();
        resize.disconnect();
        cancelAnimationFrame(frame);
        host.removeAttribute('data-scene-live');
        if (!renderer) return;
        const geometries = new Set();
        const materials = new Set();
        model?.scene.traverse(node => {
            if (node.isInstancedMesh) node.dispose();
            if (node.geometry) geometries.add(node.geometry);
            if (node.material) materials.add(node.material);
        });
        for (const geometry of geometries) geometry.dispose();
        for (const material of materials) material.dispose();
        renderer.dispose();
        if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
        renderer.domElement.remove();
        renderer = undefined;
        model = undefined;
    }
    host.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch') return;
        const box = host.getBoundingClientRect();
        pointer.x = (event.clientX - box.left) / box.width * 2 - 1;
        pointer.y = (event.clientY - box.top) / box.height * 2 - 1;
    }, listeners);
    host.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; }, listeners);
    window.addEventListener('admin:telemetry', event => {
        const votes = event.detail.report?.stats?.votes;
        if (votes != null && seenVotes != null && Number(votes) > Number(seenVotes)) impulse = 1;
        if (votes != null) seenVotes = votes;
    }, listeners);
    host.addEventListener('admin:activity', () => { impulse = 1; }, listeners);
    viewport.addEventListener('change', sync, listeners);
    reduced.addEventListener('change', sync, listeners);
    document.addEventListener('visibilitychange', sync, listeners);
    document.addEventListener('admin:effects', sync, listeners);
    signal.addEventListener('abort', dispose, { ...listeners, once: true });
    observer.observe(host);
    resize.observe(host);
}
