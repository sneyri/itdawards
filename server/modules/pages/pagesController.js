import { control, dist } from './paths.js';

export function serveAdminPage(req, res) {
    res.set('Cache-Control', 'no-store');
    if (!req.user) return res.redirect('/sign-in?return_to=%2Fadmin');
    if (!['MANAGER', 'SUPERADMIN'].includes(req.user.role)) {
        return res.status(403).type('text').send('Недостаточно прав для входа в панель управления.');
    }
    return res.sendFile('index.html', { root: control });
}
export function serveAccountPage(req, res) {
    const destination = req.query.return_to === '/admin' ? '/sign-in?return_to=%2Fadmin' : '/sign-in';
    return res.set('Cache-Control', 'no-store').redirect(destination);
}

export function servePublicPage(_req, res) {
    res.set('Cache-Control', 'no-cache').sendFile('index.html', { root: dist });
}
