import { Router } from "express";

import { test } from "./juryControllers.js";

const router = Router();
router.get('/test', test);

export default router