import { Router } from 'express';
import passport from 'passport';
import * as authController from '../controllers/auth.controller';

const router = Router();

// Register a new user
router.post('/register', authController.register);

// Login
router.post('/login', authController.login);

// Refresh token
router.post('/refresh-token', authController.refreshToken);

// Generate API key
router.post('/users/:userId/api-keys', authController.generateApiKey);

// GitHub OAuth routes
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  authController.oauthCallback
);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  authController.oauthCallback
);

export const authRoutes = router;