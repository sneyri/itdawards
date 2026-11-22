import { Router } from 'express';
import { serveCatalogAudio } from './audio.js';

const router = Router();
router.get('/:id', serveCatalogAudio);

export default router;
