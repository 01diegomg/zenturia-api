// --- src/routes/schedule.routes.js ---
import { Router } from 'express';
import * as scheduleController from '../controllers/schedule.controller.js';
import { sanitizeInput } from '../middleware/sanitize.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Apply input sanitization
router.use(sanitizeInput);

// Public routes (read-only)
router.get('/', scheduleController.getSchedule);
router.get('/overrides', scheduleController.getOverrides);

// Admin routes (protected)
router.post('/', authenticateToken, requireAdmin, scheduleController.updateSchedule);
router.post('/overrides', authenticateToken, requireAdmin, scheduleController.createOverride);
router.delete('/overrides/:date', authenticateToken, requireAdmin, scheduleController.deleteOverride);

export default router;
