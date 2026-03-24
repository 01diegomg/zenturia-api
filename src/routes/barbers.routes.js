// --- src/routes/barbers.routes.js ---
import { Router } from 'express';
import * as barbersController from '../controllers/barbers.controller.js';
import { sanitizeInput } from '../middleware/sanitize.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Apply input sanitization
router.use(sanitizeInput);

// Admin routes (protected) - MUST be before /:id routes to avoid conflicts
router.get('/admin/all', authenticateToken, requireAdmin, barbersController.getAllBarbersAdmin);

// Public routes
router.get('/', barbersController.getAllBarbers);
router.get('/available', barbersController.getAvailableBarbersForDate);
router.get('/:id', barbersController.getBarberById);

// Admin routes with :id parameter (protected)
router.post('/', authenticateToken, requireAdmin, barbersController.createBarber);
router.put('/:id', authenticateToken, requireAdmin, barbersController.updateBarber);
router.delete('/:id', authenticateToken, requireAdmin, barbersController.deleteBarber);
router.put('/:id/schedule', authenticateToken, requireAdmin, barbersController.updateBarberSchedule);
router.post('/:id/overrides', authenticateToken, requireAdmin, barbersController.createBarberOverride);
router.delete('/:id/overrides/:overrideId', authenticateToken, requireAdmin, barbersController.deleteBarberOverride);

export default router;
