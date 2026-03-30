// --- src/routes/haircuts.routes.js ---
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as haircutsController from '../controllers/haircuts.controller.js';
import { sanitizeInput } from '../middleware/sanitize.js';
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

// Apply input sanitization
router.use(sanitizeInput);

// Public routes (read-only)
router.get('/', haircutsController.getAllHaircuts);
router.get('/:id', haircutsController.getHaircutById);

// Admin routes (protected) - with image upload
router.post('/', authenticateToken, requireAdmin, upload.single('image'), haircutsController.createHaircut);
router.put('/:id', authenticateToken, requireAdmin, upload.single('image'), haircutsController.updateHaircut);
router.delete('/:id', authenticateToken, requireAdmin, haircutsController.deleteHaircut);

export default router;
