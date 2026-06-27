import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { UserController } from '../controllers/userController.js';

const router = Router();

router.post('/api/register', authLimiter, UserController.register);
router.post('/api/login', authLimiter, UserController.login);
router.get('/api/auth/me', requireAuth, UserController.me);

router.get('/api/users', requireAuth, UserController.getUsers);
router.post('/api/users', requireAuth, UserController.updateUser);
router.put('/api/users/:id/avatar', requireAuth, UserController.updateAvatar);

export default router;
