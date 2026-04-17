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
import reviewsRoutes from './reviews.routes.js';
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

// Test endpoint for image upload pipeline - helps debug facial analysis issues
router.post('/test-image-upload', upload.single('image'), async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        steps: {
            multerReceived: false,
            cloudinaryConfigured: false,
            cloudinaryUpload: { success: false },
            faceppConfigured: false,
            faceppTest: { success: false }
        }
    };

    try {
        // Step 1: Check if multer received the file
        if (req.file) {
            results.steps.multerReceived = true;
            results.fileInfo = {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                bufferLength: req.file.buffer?.length || 0
            };
        } else {
            results.error = 'No file received by multer';
            return res.json(results);
        }

        // Step 2: Check Cloudinary config
        const cloudinaryConfig = {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            apiSecret: process.env.CLOUDINARY_API_SECRET
        };
        results.steps.cloudinaryConfigured = !!(cloudinaryConfig.cloudName && cloudinaryConfig.apiKey && cloudinaryConfig.apiSecret);

        if (!results.steps.cloudinaryConfigured) {
            results.error = 'Cloudinary not configured';
            return res.json(results);
        }

        // Step 3: Try Cloudinary upload
        const cloudinary = (await import('../../cloudinaryConfig.js')).default;
        try {
            const uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: 'barberia/test-uploads' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(req.file.buffer);
            });

            results.steps.cloudinaryUpload = {
                success: true,
                url: uploadResult.secure_url,
                publicId: uploadResult.public_id,
                format: uploadResult.format,
                width: uploadResult.width,
                height: uploadResult.height,
                bytes: uploadResult.bytes
            };
        } catch (cloudinaryError) {
            results.steps.cloudinaryUpload = {
                success: false,
                error: cloudinaryError.message
            };
            return res.json(results);
        }

        // Step 4: Check Face++ config
        const faceppKey = process.env.FACEPP_API_KEY;
        const faceppSecret = process.env.FACEPP_API_SECRET;
        results.steps.faceppConfigured = !!(faceppKey && faceppSecret);

        // Step 5: Test Face++ with the uploaded image
        if (results.steps.faceppConfigured && results.steps.cloudinaryUpload.success) {
            try {
                const formData = new URLSearchParams();
                formData.append('api_key', faceppKey);
                formData.append('api_secret', faceppSecret);
                formData.append('image_url', results.steps.cloudinaryUpload.url);
                formData.append('return_attributes', 'faceshape');

                const faceppResponse = await fetch('https://api-us.faceplusplus.com/facepp/v3/detect', {
                    method: 'POST',
                    body: formData
                });
                const faceppData = await faceppResponse.json();

                if (faceppData.error_message) {
                    results.steps.faceppTest = {
                        success: false,
                        error: faceppData.error_message
                    };
                } else if (faceppData.faces && faceppData.faces.length > 0) {
                    const face = faceppData.faces[0];
                    results.steps.faceppTest = {
                        success: true,
                        faceDetected: true,
                        faceShape: face.attributes?.faceshape?.value || 'unknown',
                        confidence: face.attributes?.faceshape?.confidence || 0,
                        faceRectangle: face.face_rectangle
                    };
                } else {
                    results.steps.faceppTest = {
                        success: true,
                        faceDetected: false,
                        message: 'No face detected in image'
                    };
                }
            } catch (faceppError) {
                results.steps.faceppTest = {
                    success: false,
                    error: faceppError.message
                };
            }
        }

        results.allPassed = results.steps.multerReceived &&
                           results.steps.cloudinaryUpload.success &&
                           results.steps.faceppTest.success;

        res.json(results);
    } catch (error) {
        results.error = error.message;
        results.stack = error.stack;
        res.status(500).json(results);
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
router.use('/reviews', reviewsRoutes);

export default router;
