import { Router } from 'express';
import * as UserController from '../controllers/UserController';
import { authenticate } from '../middleware/authMiddleware';
import { uploadProfileImage } from '../middleware/uploadMiddleware';

const router = Router();

router.get('/', UserController.getTest);
router.post('/create', uploadProfileImage.single('profileImage'), UserController.postUser);
router.post('/login', UserController.login);
router.patch('/edit/:id', authenticate, uploadProfileImage.single('profileImage'), UserController.updateProfile);
router.get('/:id', UserController.getuser); // New Route to get user by ID
export default router;