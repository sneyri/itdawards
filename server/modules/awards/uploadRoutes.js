import { Router } from 'express';
import { uploadCatalogImage } from './images.js';
import { parseCatalogImage } from '../../middleware/requestBody.js';
import { requireRole } from '../auth/sessions.js';

const router = Router();
router.post('/images', requireRole('MANAGER', 'SUPERADMIN'),
    parseCatalogImage, uploadCatalogImage);

export default router;
