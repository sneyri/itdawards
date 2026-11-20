import express from 'express';
import { assets, control, dist } from './paths.js';

export const builtSiteFiles = express.static(dist, { index: false });
export const originalAssets = express.static(assets);

export function serveControlFile(req, res) {
    res.set('Cache-Control', 'no-cache').sendFile(req.params[0], { root: control });
}
