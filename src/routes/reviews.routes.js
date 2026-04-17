// --- src/routes/reviews.routes.js ---
import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import * as reviewsController from '../controllers/reviews.controller.js';

const router = Router();

// Cliente crea una reseña (requiere auth)
router.post('/', authenticateToken, reviewsController.createReview);

// Admin obtiene resumen de reseñas
router.get('/summary', authenticateToken, requireAdmin, reviewsController.getReviewsSummary);

// Admin obtiene stats del dashboard (revenue + reviews)
router.get('/dashboard', authenticateToken, requireAdmin, reviewsController.getDashboardStats);

export default router;
