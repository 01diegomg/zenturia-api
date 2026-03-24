// --- src/routes/auth.routes.js ---
import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { sanitizeInput } from '../middleware/sanitize.js';

const router = Router();

// Apply input sanitization
router.use(sanitizeInput);

// Public routes (matching original API)
router.post('/register/client', authController.registerClient);
router.post('/login/client', authController.loginClient);
router.post('/login/admin', authController.loginAdmin);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);

// Protected routes
router.post('/logout-all', authenticateToken, authController.logoutAll);
router.get('/me', authenticateToken, authController.getCurrentUser);
router.put('/profile', authenticateToken, authController.updateProfile);

export default router;
