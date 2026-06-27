import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ChannelController } from '../controllers/channelController.js';

const router = Router();

router.get('/api/channels', requireAuth, ChannelController.getChannels);
router.post('/api/channels', requireAuth, ChannelController.createChannel);

export default router;
