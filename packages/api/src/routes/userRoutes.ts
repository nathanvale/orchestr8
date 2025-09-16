import { Router } from 'express';
import { register, login, getUser } from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/:id', requireAuth, getUser);

export default router;
