import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ActivityController } from '../controllers/activityController.js';

const router = Router();

router.get('/api/activities', requireAuth, ActivityController.getActivities);
router.post('/api/activities', requireAuth, ActivityController.createActivity);

export default router;
