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

// Test Replicate API endpoint - tests multiple models to find working ones
router.get('/ai-test-replicate', async (req, res) => {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        return res.json({ success: false, error: 'REPLICATE_API_TOKEN not configured' });
    }

    const modelsToTest = [
        { name: 'sdxl-lightning', model: 'bytedance/sdxl-lightning-4step' },
        { name: 'flux-schnell', model: 'black-forest-labs/flux-schnell' },
        { name: 'stable-diffusion', model: 'stability-ai/stable-diffusion' }
    ];

    try {
        const results = {};

        for (const m of modelsToTest) {
            try {
                const versionsRes = await fetch(`https://api.replicate.com/v1/models/${m.model}/versions`, {
                    headers: { 'Authorization': `Token ${token}` }
                });
                const versions = await versionsRes.json();
                const latestVersion = versions.results?.[0]?.id;

                if (latestVersion) {
                    // Try a quick prediction
                    const testRes = await fetch('https://api.replicate.com/v1/predictions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Token ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            version: latestVersion,
                            input: { prompt: "test haircut portrait" }
                        })
                    });
                    const prediction = await testRes.json();

                    results[m.name] = {
                        available: true,
                        version: latestVersion,
                        canCreate: testRes.status === 201,
                        error: prediction.error || prediction.detail || null
                    };
                } else {
                    results[m.name] = { available: false };
                }
            } catch (e) {
                results[m.name] = { available: false, error: e.message };
            }
        }

        res.json({ success: true, models: results });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
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
