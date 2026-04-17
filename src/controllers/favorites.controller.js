// --- src/controllers/favorites.controller.js ---
// Gestión de fotos favoritas de simulaciones IA
import { prisma } from '../config/database.js';

/**
 * POST /favorites - Agregar foto a favoritos
 */
export async function addFavorite(req, res) {
    try {
        const userId = req.user.userId;
        const { imageUrl, haircutName, analysisId, photoTakenAt } = req.body;

        if (!imageUrl || !haircutName || !analysisId) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere imageUrl, haircutName y analysisId.'
            });
        }

        // Verificar que el análisis pertenece al usuario
        const analysis = await prisma.facialAnalysis.findFirst({
            where: { id: analysisId, userId }
        });

        if (!analysis) {
            return res.status(404).json({
                success: false,
                message: 'Análisis no encontrado.'
            });
        }

        // Verificar si ya existe
        const existing = await prisma.favoritePhoto.findFirst({
            where: { userId, imageUrl }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Esta foto ya está en favoritos.'
            });
        }

        // Crear favorito
        const favorite = await prisma.favoritePhoto.create({
            data: {
                userId,
                imageUrl,
                haircutName,
                analysisId,
                photoTakenAt: photoTakenAt ? new Date(photoTakenAt) : analysis.createdAt
            }
        });

        console.log(`[Favorites] Added favorite for user ${userId}: ${haircutName}`);

        res.status(201).json({
            success: true,
            favorite: {
                id: favorite.id,
                imageUrl: favorite.imageUrl,
                haircutName: favorite.haircutName,
                photoTakenAt: favorite.photoTakenAt,
                createdAt: favorite.createdAt
            }
        });
    } catch (error) {
        console.error('[Favorites] Error adding:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al agregar favorito.'
        });
    }
}

/**
 * DELETE /favorites/:id - Quitar foto de favoritos
 */
export async function removeFavorite(req, res) {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const favorite = await prisma.favoritePhoto.findFirst({
            where: { id, userId }
        });

        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: 'Favorito no encontrado.'
            });
        }

        await prisma.favoritePhoto.delete({
            where: { id }
        });

        console.log(`[Favorites] Removed favorite ${id} for user ${userId}`);

        res.status(200).json({
            success: true,
            message: 'Foto eliminada de favoritos.'
        });
    } catch (error) {
        console.error('[Favorites] Error removing:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al eliminar favorito.'
        });
    }
}

/**
 * GET /favorites - Obtener todas las fotos favoritas del usuario
 */
export async function getFavorites(req, res) {
    try {
        const userId = req.user.userId;

        const favorites = await prisma.favoritePhoto.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            favorites: favorites.map(f => ({
                id: f.id,
                imageUrl: f.imageUrl,
                haircutName: f.haircutName,
                analysisId: f.analysisId,
                photoTakenAt: f.photoTakenAt,
                createdAt: f.createdAt
            }))
        });
    } catch (error) {
        console.error('[Favorites] Error fetching:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener favoritos.'
        });
    }
}

/**
 * GET /favorites/check/:imageUrl - Verificar si una imagen está en favoritos
 */
export async function checkFavorite(req, res) {
    try {
        const userId = req.user.userId;
        const imageUrl = decodeURIComponent(req.params.imageUrl);

        const favorite = await prisma.favoritePhoto.findFirst({
            where: { userId, imageUrl }
        });

        res.status(200).json({
            success: true,
            isFavorite: !!favorite,
            favoriteId: favorite?.id || null
        });
    } catch (error) {
        console.error('[Favorites] Error checking:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al verificar favorito.'
        });
    }
}

export default {
    addFavorite,
    removeFavorite,
    getFavorites,
    checkFavorite
};
