import { fileURLToPath } from 'node:url';
import express from 'express';

const router = express.Router();
const dist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
const assets = fileURLToPath(new URL('../../client/assets/', import.meta.url));

router.use(express.static(dist, { index: false }));
router.use('/assets', express.static(assets));

// React получает адреса страниц. Исключаем /assets и пути с точкой.
const pagePath = /^\/(?!assets(?:\/|$))[^.]*$/;
router.get(pagePath, (_req, res) => {
    res.set('Cache-Control', 'no-cache').sendFile('index.html', { root: dist });
});

export default router;
