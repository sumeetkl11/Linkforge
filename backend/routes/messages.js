import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { MessageController } from '../controllers/messageController.js';

const router = Router();

router.get('/api/messages/:chatId', requireAuth, MessageController.getMessages);
router.post('/api/messages', requireAuth, MessageController.createMessage);

export default router;
