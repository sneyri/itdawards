import { Router } from "express";

import { test, upload_jury_review } from "./juryControllers.js";

const router = Router();
router.get('/test', test);
router.post('/upload', upload_jury_review)

export default router