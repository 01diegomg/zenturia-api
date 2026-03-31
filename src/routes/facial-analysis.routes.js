// --- src/routes/facial-analysis.routes.js ---
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as facialAnalysisController from '../controllers/facial-analysis.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Configure multer for image uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
    }
});

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// POST /facial-analysis - Analizar rostro y obtener recomendaciones
router.post('/', upload.single('image'), facialAnalysisController.analyzeFace);

// POST /facial-analysis/:id/simulate - Generar simulaciones con IA
router.post('/:id/simulate', facialAnalysisController.generateSimulations);

// GET /facial-analysis/history - Obtener historial de análisis
router.get('/history', facialAnalysisController.getAnalysisHistory);

// GET /facial-analysis/:id - Obtener un análisis específico
router.get('/:id', facialAnalysisController.getAnalysisById);

export default router;
