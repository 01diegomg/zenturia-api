// --- src/controllers/gallery.controller.js ---
import { prisma } from '../config/database.js';
import cloudinary from '../../cloudinaryConfig.js';

/**
 * Get all gallery images
 */
export async function getAllImages(req, res) {
    try {
        const images = await prisma.galleryImage.findMany({
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            images
        });
    } catch (error) {
        console.error('Error al obtener imágenes:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener imágenes.'
        });
    }
}

/**
 * Add image to gallery
 */
export async function addImage(req, res) {
    try {
        const { url, altText } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'La URL de la imagen es requerida.'
            });
        }

        const newImage = await prisma.galleryImage.create({
            data: { url, altText: altText || '' }
        });

        res.status(201).json({
            success: true,
            message: 'Imagen añadida a la galería.',
            image: newImage
        });
    } catch (error) {
        console.error('Error al agregar imagen:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al agregar imagen.'
        });
    }
}

/**
 * Delete image from gallery
 */
export async function deleteImage(req, res) {
    try {
        const { id } = req.params;

        await prisma.galleryImage.delete({ where: { id } });

        res.status(200).json({
            success: true,
            message: 'Imagen eliminada.'
        });
    } catch (error) {
        console.error('Error al eliminar imagen:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al eliminar imagen.'
        });
    }
}

/**
 * Upload image to Cloudinary (using buffer for Railway compatibility)
 */
export async function uploadImage(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se subió ningún archivo.'
            });
        }

        // Upload from buffer using upload_stream
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'barberia' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(req.file.buffer);
        });

        res.status(200).json({
            success: true,
            url: result.secure_url
        });
    } catch (error) {
        console.error('Error al subir imagen:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al subir imagen.'
        });
    }
}

export default {
    getAllImages,
    addImage,
    deleteImage,
    uploadImage
};
