// --- src/routes/favorites.routes.js ---
import express from 'express';
import * as favoritesController from '../controllers/favorites.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.post('/', authenticateToken, favoritesController.addFavorite);
router.delete('/:id', authenticateToken, favoritesController.removeFavorite);
router.get('/', authenticateToken, favoritesController.getFavorites);
router.get('/check/:imageUrl', authenticateToken, favoritesController.checkFavorite);

export default router;
