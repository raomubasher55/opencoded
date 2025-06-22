import { Router } from 'express';
import * as userController from '../controllers/user.controller';

const router = Router();

// Get all users
router.get('/', userController.getUsers);

// Get user by ID
router.get('/:userId', userController.getUserById);

// Update user
router.put('/:userId', userController.updateUser);

// Delete user
router.delete('/:userId', userController.deleteUser);

export const userRoutes = router;