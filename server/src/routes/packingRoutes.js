import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listPacking, createPacking, getPackingDetail } from '../controllers/packingController.js';

const router = Router();

router.use(requireAuth);
router.get('/', listPacking);
router.post('/', createPacking);
router.get('/:id', getPackingDetail);

export default router;
