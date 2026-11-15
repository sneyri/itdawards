import { Router } from 'express';
import { getNominees } from '../controllers/nominees.js';

const router = Router();

router.get('/nominations/:id/nominees', getNominees);

export default router;
