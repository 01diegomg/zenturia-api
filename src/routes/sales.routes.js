// --- src/routes/sales.routes.js ---
import { Router } from 'express';
import * as salesController from '../controllers/sales.controller.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Todas las rutas de ventas requieren autenticación de admin
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/sales/stats?period=today|week|month|year|custom
router.get('/stats', salesController.getSalesStats);

// GET /api/sales/daily - Resumen rápido del día
router.get('/daily', salesController.getDailySummary);

export default router;
