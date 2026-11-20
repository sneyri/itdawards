import { Router } from 'express';
import { readSession } from '../auth/sessions.js';
import { serveAccountPage, serveAdminPage, servePublicPage } from './pagesController.js';
import { builtSiteFiles, originalAssets, serveControlFile } from './staticFiles.js';

const router = Router();
router.get('/admin', readSession, serveAdminPage);
router.get('/account', serveAccountPage);
router.get(/^\/control\/([a-z-]+\.(?:css|js))$/, serveControlFile);
router.use(builtSiteFiles);
router.use('/assets', originalAssets);
router.get(/^\/(?!assets(?:\/|$))[^.]*$/, servePublicPage);

export default router;
