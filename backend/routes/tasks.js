import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { TaskController } from '../controllers/taskController.js';

const router = Router();

router.get('/api/tasks', requireAuth, TaskController.getTasks);
router.post('/api/tasks', requireAuth, TaskController.createTask);
router.put('/api/tasks/:id', requireAuth, TaskController.updateTask);
router.delete('/api/tasks/:id', requireAuth, TaskController.deleteTask);

export default router;
