import { Router } from 'express';
import { uploadCatalogImage, serveCatalogImage } from '../awards/images.js';
import { uploadCatalogAudio, serveCatalogAudio } from '../awards/audio.js';
import { parseCatalogAudio, parseCatalogImage } from '../../middleware/requestBody.js';
import { readSession, requireRole } from '../auth/sessions.js';

const router = Router();

router.get('/media/:id', serveCatalogImage);
router.get('/audio/:id', serveCatalogAudio);
router.post('/admin/uploads/images', readSession, requireRole('MANAGER', 'SUPERADMIN'),
    parseCatalogImage, uploadCatalogImage);
router.post('/admin/uploads/audio', readSession, requireRole('MANAGER', 'SUPERADMIN'),
    parseCatalogAudio, uploadCatalogAudio);

export default router;
