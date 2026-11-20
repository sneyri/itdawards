import { Router } from 'express';
import { login, logout, getCurrentSession, passwordLoginRetired } from './authController.js';
import { readSession } from './sessions.js';
import { limitLogin } from '../../middleware/security.js';

const router = Router();
router.get('/me', readSession, getCurrentSession);
router.post('/login', limitLogin, login);
router.post('/logout', logout);
router.post('/invitations/redeem', limitLogin, login);
router.post('/password/login', passwordLoginRetired);
router.post('/password/recover', passwordLoginRetired);

export default router;
