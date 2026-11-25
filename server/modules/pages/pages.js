import express, { Router } from 'express';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSession } from '../auth/sessions.js';

export const dist = fileURLToPath(new URL('../../../client/dist/', import.meta.url));
export const assets = fileURLToPath(new URL('../../../client/assets/', import.meta.url));
export const control = fileURLToPath(new URL('../../../client/admin/', import.meta.url));

const router = Router();

router.get('/admin', readSession, (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!req.user) return res.redirect('/sign-in?return_to=%2Fadmin');
    if (!['MANAGER', 'SUPERADMIN'].includes(req.user.role)) {
        return res.status(403).type('text').send('Недостаточно прав для входа в панель управления.');
    }
    return res.sendFile('index.html', { root: control });
});

router.get('/account', (req, res) => {
    const destination = req.query.return_to === '/admin' ? '/sign-in?return_to=%2Fadmin' : '/sign-in';
    return res.set('Cache-Control', 'no-store').redirect(destination);
});

router.use(express.static(dist, {
    index: false,
    setHeaders(res, path) {
        if (dirname(path) === join(dist, 'assets')
            && /-[a-zA-Z0-9_-]{8,}\.(?:js|css|woff2?|png|webp|avif|svg|jpe?g)$/.test(basename(path))) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    },
}));
router.use('/assets', express.static(assets));
router.get(/^\/control\/([a-z-]+\.(?:css|js))$/, (req, res) => {
    res.set('Cache-Control', 'no-cache').sendFile(req.params[0], { root: control });
});
router.get(/^\/(?!assets(?:\/|$))[^.]*$/, (_req, res) => {
    res.set('Cache-Control', 'no-cache').sendFile('index.html', { root: dist });
});

export default router;
