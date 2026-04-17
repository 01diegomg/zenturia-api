// --- src/routes/notifications.routes.js ---
import { Router } from 'express';
import * as notificationsController from '../controllers/notifications.controller.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All notification routes require authentication
// Send notification to specific user (admin only)
router.post('/send', authenticateToken, requireAdmin, notificationsController.sendNotification);

// Send batch notifications (admin only)
router.post('/send-batch', authenticateToken, requireAdmin, notificationsController.sendBatchNotifications);

// Send to all users with a role (admin only)
router.post('/send-to-role', authenticateToken, requireAdmin, notificationsController.sendToRole);

export default router;
