import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listActivity } from '../controllers/activityController.js';

const router = Router();

router.get('/', requireAuth, listActivity);

export default router;
