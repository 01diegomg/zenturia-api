// --- src/routes/index.js ---
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import authRoutes from './auth.routes.js';
import appointmentsRoutes from './appointments.routes.js';
import contentRoutes from './content.routes.js';
import servicesRoutes from './services.routes.js';
import galleryRoutes from './gallery.routes.js';
import scheduleRoutes from './schedule.routes.js';
import salesRoutes from './sales.routes.js';
import barbersRoutes from './barbers.routes.js';
import haircutsRoutes from './haircuts.routes.js';
import facialAnalysisRoutes from './facial-analysis.routes.js';
import * as galleryController from '../controllers/gallery.controller.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Configure multer for file uploads - using memory storage for Railway compatibility
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Solo se permiten imágenes'));
    }
});

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Services diagnostic endpoint (no auth required - no secrets exposed)
router.get('/ai-status', (req, res) => {
    const status = {
        timestamp: new Date().toISOString(),
        services: {
            facepp: {
                configured: !!(process.env.FACEPP_API_KEY && process.env.FACEPP_API_SECRET),
                hasKey: !!process.env.FACEPP_API_KEY,
                hasSecret: !!process.env.FACEPP_API_SECRET
            },
            replicate: {
                configured: !!process.env.REPLICATE_API_TOKEN,
                tokenLength: process.env.REPLICATE_API_TOKEN ? process.env.REPLICATE_API_TOKEN.length : 0,
                tokenPrefix: process.env.REPLICATE_API_TOKEN ? process.env.REPLICATE_API_TOKEN.substring(0, 4) + '...' : 'N/A'
            },
            fal: {
                configured: !!process.env.FAL_API_KEY,
                keyLength: process.env.FAL_API_KEY ? process.env.FAL_API_KEY.length : 0
            }
        },
        simulationsEnabled: !!(process.env.REPLICATE_API_TOKEN || process.env.FAL_API_KEY),
        analysisEnabled: !!(process.env.FACEPP_API_KEY && process.env.FACEPP_API_SECRET)
    };
    res.json(status);
});

// Direct upload endpoint (matches original /upload) - requires admin auth
router.post('/upload', authenticateToken, requireAdmin, upload.single('image'), galleryController.uploadImage);

// Mount routes
router.use('/', authRoutes); // /login/*, /register/*, /logout, etc.
router.use('/appointments', appointmentsRoutes);
router.use('/content', contentRoutes);
router.use('/content/services', servicesRoutes);
router.use('/gallery', galleryRoutes);
router.use('/schedule', scheduleRoutes);
router.use('/sales', salesRoutes);
router.use('/barbers', barbersRoutes);
router.use('/haircuts', haircutsRoutes);
router.use('/facial-analysis', facialAnalysisRoutes);

export default router;
