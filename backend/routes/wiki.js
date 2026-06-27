import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { WikiController } from '../controllers/wikiController.js';

const router = Router();

router.get('/api/wiki', requireAuth, WikiController.getWikiPages);
router.post('/api/wiki', requireAuth, WikiController.saveWikiPage);
router.delete('/api/wiki/:id', requireAuth, WikiController.deleteWikiPage);

export default router;
