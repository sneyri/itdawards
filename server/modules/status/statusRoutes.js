import { Router } from "express";
import { health } from "./statusController.js";

const router = Router();

router.get('', health)

export default router;
