// --- src/routes/gallery.routes.js ---
import { Router } from 'express';
import * as galleryController from '../controllers/gallery.controller.js';
import { sanitizeInput } from '../middleware/sanitize.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Apply input sanitization
router.use(sanitizeInput);

// Public routes (read-only)
router.get('/', galleryController.getAllImages);

// Admin routes (protected)
router.post('/images', authenticateToken, requireAdmin, galleryController.addImage);
router.delete('/images/:id', authenticateToken, requireAdmin, galleryController.deleteImage);

export default router;
