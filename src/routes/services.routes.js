// --- src/routes/services.routes.js ---
import { Router } from 'express';
import * as servicesController from '../controllers/services.controller.js';
import { sanitizeInput } from '../middleware/sanitize.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Apply input sanitization
router.use(sanitizeInput);

// Public routes (read-only)
router.get('/', servicesController.getAllServices);

// Admin routes (protected)
router.post('/', authenticateToken, requireAdmin, servicesController.createService);
router.put('/:id', authenticateToken, requireAdmin, servicesController.updateService);
router.delete('/:id', authenticateToken, requireAdmin, servicesController.deleteService);

export default router;
