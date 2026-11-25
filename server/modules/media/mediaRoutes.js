import { Router } from 'express';
import { uploadCatalogImage } from '../awards/images.js';
import { uploadCatalogAudio } from '../awards/audio.js';
import { serveCatalogMedia, serveThumbnail } from './catalogMedia.js';
import { audioMedia, imageMedia } from './mediaStorage.js';
import { parseCatalogAudio, parseCatalogImage } from '../../middleware/requestBody.js';
import { readSession, requireRole } from '../auth/sessions.js';

const router = Router();

router.get('/media/thumbnails/:id', serveThumbnail);
router.get('/media/:id', (req, res) => serveCatalogMedia(req, res, imageMedia));
router.get('/audio/:id', (req, res) => serveCatalogMedia(req, res, audioMedia));
router.post('/admin/uploads/images', readSession, requireRole('MANAGER', 'SUPERADMIN'),
    parseCatalogImage, uploadCatalogImage);
router.post('/admin/uploads/audio', readSession, requireRole('MANAGER', 'SUPERADMIN'),
    parseCatalogAudio, uploadCatalogAudio);

export default router;
