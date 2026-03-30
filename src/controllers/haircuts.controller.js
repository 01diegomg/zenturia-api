// --- src/controllers/haircuts.controller.js ---
import { prisma } from '../config/database.js';
import cloudinary from '../../cloudinaryConfig.js';

/**
 * Get all haircuts (public)
 */
export async function getAllHaircuts(req, res) {
    try {
        const haircuts = await prisma.haircut.findMany({
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            haircuts
        });
    } catch (error) {
        console.error('Error al obtener cortes:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener cortes.'
        });
    }
}

/**
 * Get single haircut by ID
 */
export async function getHaircutById(req, res) {
    try {
        const { id } = req.params;

        const haircut = await prisma.haircut.findUnique({
            where: { id }
        });

        if (!haircut) {
            return res.status(404).json({
                success: false,
                message: 'Corte no encontrado.'
            });
        }

        res.status(200).json({
            success: true,
            haircut
        });
    } catch (error) {
        console.error('Error al obtener corte:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener corte.'
        });
    }
}

/**
 * Create new haircut with Cloudinary image upload (admin only)
 */
export async function createHaircut(req, res) {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del corte es requerido.'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'La imagen del corte es requerida.'
            });
        }

        // Upload image to Cloudinary using buffer
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'barberia/haircuts' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(req.file.buffer);
        });

        const newHaircut = await prisma.haircut.create({
            data: {
                name,
                description: description || null,
                imageUrl: result.secure_url
            }
        });

        res.status(201).json({
            success: true,
            message: 'Corte creado exitosamente.',
            haircut: newHaircut
        });
    } catch (error) {
        console.error('Error al crear corte:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al crear corte.'
        });
    }
}

/**
 * Update haircut (admin only)
 */
export async function updateHaircut(req, res) {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        // Check if haircut exists
        const existingHaircut = await prisma.haircut.findUnique({
            where: { id }
        });

        if (!existingHaircut) {
            return res.status(404).json({
                success: false,
                message: 'Corte no encontrado.'
            });
        }

        let imageUrl = existingHaircut.imageUrl;

        // If new image is uploaded, upload to Cloudinary
        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: 'barberia/haircuts' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(req.file.buffer);
            });
            imageUrl = result.secure_url;
        }

        const updatedHaircut = await prisma.haircut.update({
            where: { id },
            data: {
                name: name || existingHaircut.name,
                description: description !== undefined ? description : existingHaircut.description,
                imageUrl
            }
        });

        res.status(200).json({
            success: true,
            message: 'Corte actualizado exitosamente.',
            haircut: updatedHaircut
        });
    } catch (error) {
        console.error('Error al actualizar corte:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar corte.'
        });
    }
}

/**
 * Delete haircut (admin only)
 */
export async function deleteHaircut(req, res) {
    try {
        const { id } = req.params;

        // Check if haircut exists
        const existingHaircut = await prisma.haircut.findUnique({
            where: { id }
        });

        if (!existingHaircut) {
            return res.status(404).json({
                success: false,
                message: 'Corte no encontrado.'
            });
        }

        await prisma.haircut.delete({ where: { id } });

        res.status(200).json({
            success: true,
            message: 'Corte eliminado exitosamente.'
        });
    } catch (error) {
        console.error('Error al eliminar corte:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al eliminar corte.'
        });
    }
}

export default {
    getAllHaircuts,
    getHaircutById,
    createHaircut,
    updateHaircut,
    deleteHaircut
};
