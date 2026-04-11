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

// Diagnostic endpoint - test all AI services
router.get('/ai-diagnostic', async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        cloudinary: { configured: false, working: false },
        facepp: { configured: false, working: false },
        replicate: { configured: false, working: false },
        database: { connected: false }
    };

    // Test Cloudinary
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const cloudKey = process.env.CLOUDINARY_API_KEY;
    const cloudSecret = process.env.CLOUDINARY_API_SECRET;
    results.cloudinary.configured = !!(cloudName && cloudKey && cloudSecret);
    if (results.cloudinary.configured) {
        results.cloudinary.cloudName = cloudName;
        results.cloudinary.keyLength = cloudKey?.length || 0;
    }

    // Test Face++
    const faceppKey = process.env.FACEPP_API_KEY;
    const faceppSecret = process.env.FACEPP_API_SECRET;
    results.facepp.configured = !!(faceppKey && faceppSecret);
    if (results.facepp.configured) {
        results.facepp.keyLength = faceppKey?.length || 0;
        results.facepp.secretLength = faceppSecret?.length || 0;

        // Test Face++ API with a sample image
        try {
            const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/320px-Camponotus_flavomarginatus_ant.jpg';
            const formData = new URLSearchParams();
            formData.append('api_key', faceppKey);
            formData.append('api_secret', faceppSecret);
            formData.append('image_url', testImageUrl);

            const response = await fetch('https://api-us.faceplusplus.com/facepp/v3/detect', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.error_message) {
                results.facepp.error = data.error_message;
            } else {
                results.facepp.working = true;
                results.facepp.response = 'API responded successfully (no face in test image is expected)';
            }
        } catch (e) {
            results.facepp.error = e.message;
        }
    }

    // Test Replicate
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    results.replicate.configured = !!replicateToken;
    if (results.replicate.configured) {
        results.replicate.tokenLength = replicateToken?.length || 0;
        results.replicate.tokenPrefix = replicateToken?.substring(0, 4) + '...';

        try {
            const accountRes = await fetch('https://api.replicate.com/v1/account', {
                headers: { 'Authorization': `Token ${replicateToken}` }
            });
            const accountData = await accountRes.json();

            if (accountData.username) {
                results.replicate.working = true;
                results.replicate.username = accountData.username;
            } else {
                results.replicate.error = accountData.detail || 'Unknown error';
            }
        } catch (e) {
            results.replicate.error = e.message;
        }
    }

    // Summary
    results.ready = results.cloudinary.configured && results.facepp.configured;
    results.simulationsReady = results.replicate.configured;

    res.json(results);
});

// Test Replicate API endpoint - find InstantID and other models
router.get('/ai-test-replicate', async (req, res) => {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        return res.json({ success: false, error: 'REPLICATE_API_TOKEN not configured' });
    }

    // Models to test including InstantID
    const modelsToTest = [
        { name: 'instantid', model: 'zsxkib/instant-id' },
        { name: 'photomaker', model: 'tencentarc/photomaker' },
        { name: 'sdxl-lightning', model: 'bytedance/sdxl-lightning-4step' }
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

                results[m.name] = {
                    available: !!latestVersion,
                    version: latestVersion || null,
                    model: m.model
                };
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
