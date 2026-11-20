import { Router } from 'express';
import { requireRole } from '../auth/sessions.js';
import { getStats } from './adminController.js';
import { getAudit } from './audit.js';
import { listUsers, getUser, updateUser } from '../users/usersController.js';
import {
    getAdminCatalog, exportCatalog, bulkEditCatalog, importCatalog,
    createNomination, updateNomination, deleteNomination,
    createNominee, updateNominee, deleteNominee,
} from '../awards/adminCatalog.js';
import { getSettings, updateSettings } from '../voting/settings.js';
import { getAdminResults, exportResultsCsv, exportResultsJson } from '../voting/results.js';

const router = Router();
router.use(requireRole('MANAGER', 'SUPERADMIN'));
router.get('/stats', getStats);
router.get('/catalog', getAdminCatalog);
router.get('/catalog.json', exportCatalog);
router.post('/catalog/bulk', bulkEditCatalog);
router.post('/catalog/import', importCatalog);
router.post('/nominations', createNomination);
router.patch('/nominations/:id', updateNomination);
router.delete('/nominations/:id', deleteNomination);
router.post('/nominees', createNominee);
router.patch('/nominees/:id', updateNominee);
router.delete('/nominees/:id', deleteNominee);
router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id', updateUser);
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);

router.use(requireRole('SUPERADMIN'));
router.get('/audit', getAudit);
router.get('/results', getAdminResults);
router.get('/results.csv', exportResultsCsv);
router.get('/results.json', exportResultsJson);

export default router;
