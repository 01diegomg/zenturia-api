// --- src/routes/appointments.routes.js ---
import { Router } from 'express';
import * as appointmentsController from '../controllers/appointments.controller.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sanitizeInput } from '../middleware/sanitize.js';
import { bookingLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply input sanitization
router.use(sanitizeInput);

// More specific routes FIRST (before /:id pattern)
router.get('/my', authenticateToken, appointmentsController.getMyAppointments);
router.get('/available-slots', appointmentsController.getAvailableSlots);
router.get('/next-available', appointmentsController.getNextAvailableDays);

// Generic routes (admin only - contains sensitive client data)
router.get('/', authenticateToken, requireAdmin, appointmentsController.getAllAppointments);
router.post('/create', bookingLimiter, appointmentsController.createAppointment);

// Parametric routes LAST
router.delete('/:id', authenticateToken, appointmentsController.cancelAppointment);

export default router;
