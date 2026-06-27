import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { SystemController } from '../controllers/systemController.js';

const router = Router();

router.get('/health', SystemController.health);
router.post('/api/reset', requireAuth, SystemController.reset);

export default router;
