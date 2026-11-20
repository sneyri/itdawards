import { Router } from 'express';
import { serveCatalogImage } from './images.js';

const router = Router();
router.get('/:id', serveCatalogImage);

export default router;
