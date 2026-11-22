import { Router } from 'express';
import { uploadCatalogImage } from './images.js';
import { uploadCatalogAudio } from './audio.js';
import { parseCatalogAudio, parseCatalogImage } from '../../middleware/requestBody.js';
import { requireRole } from '../auth/sessions.js';

const router = Router();
router.post('/images', requireRole('MANAGER', 'SUPERADMIN'),
    parseCatalogImage, uploadCatalogImage);
router.post('/audio', requireRole('MANAGER', 'SUPERADMIN'),
    parseCatalogAudio, uploadCatalogAudio);

export default router;
