import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listStock, createStock, updateStock, deleteStock, listProducts } from '../controllers/stockController.js';

const router = Router();

router.use(requireAuth);
router.get('/', listStock);
router.post('/', createStock);
router.put('/:id', updateStock);
router.delete('/:id', deleteStock);
router.get('/products/all', listProducts);

export default router;
