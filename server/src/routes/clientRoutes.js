import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  getClientDetail,
} from '../controllers/clientController.js';

const router = Router();

router.use(requireAuth);
router.get('/', listClients);
router.post('/', createClient);
router.get('/:id', getClientDetail);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);

export default router;
