// --- src/routes/content.routes.js ---
import { Router } from 'express';
import * as contentController from '../controllers/content.controller.js';
import { sanitizeInput, sanitizeCmsInput } from '../middleware/sanitize.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public routes
router.get('/public', contentController.getPublicContent);
router.get('/setup-status', contentController.getSetupStatus);

// Setup route - AHORA requiere autenticación de admin
// Solo el admin puede configurar el sitio por primera vez
router.post('/setup', authenticateToken, requireAdmin, sanitizeInput, contentController.initialSetup);

// Admin routes (protected)
router.put('/palette', authenticateToken, requireAdmin, sanitizeInput, contentController.updatePalette);
router.put('/texts', authenticateToken, requireAdmin, sanitizeInput, contentController.updateTexts);
router.put('/about', authenticateToken, requireAdmin, sanitizeCmsInput(['text']), contentController.updateAbout);
router.put('/hero-background', authenticateToken, requireAdmin, sanitizeInput, contentController.updateHeroBackground);
router.put('/location', authenticateToken, requireAdmin, sanitizeCmsInput(['address', 'schedule']), contentController.updateLocation);
router.put('/business', authenticateToken, requireAdmin, sanitizeInput, contentController.updateBusiness);
router.put('/social', authenticateToken, requireAdmin, sanitizeInput, contentController.updateSocial);

// Testimonials routes
router.get('/testimonials', contentController.getTestimonials);
router.get('/testimonials/all', authenticateToken, requireAdmin, contentController.getAllTestimonials);
router.post('/testimonials', authenticateToken, requireAdmin, sanitizeInput, contentController.createTestimonial);
router.put('/testimonials/:id', authenticateToken, requireAdmin, sanitizeInput, contentController.updateTestimonial);
router.delete('/testimonials/:id', authenticateToken, requireAdmin, contentController.deleteTestimonial);

export default router;
