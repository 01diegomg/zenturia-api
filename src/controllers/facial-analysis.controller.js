// --- src/controllers/facial-analysis.controller.js ---
// Módulo IA: Análisis Facial + Simulaciones con Face++ y FAL.ai
import { prisma } from '../config/database.js';
import cloudinary from '../../cloudinaryConfig.js';

// Mapeo de formas de rostro a cortes recomendados
const FACE_SHAPE_RECOMMENDATIONS = {
    'oval': ['Fade Clásico', 'Pompadour', 'Undercut'],
    'round': ['Quiff', 'Faux Hawk', 'Side Part'],
    'square': ['Buzz Cut', 'Crew Cut', 'Textured Crop'],
    'heart': ['Side Swept', 'Fringe', 'Medium Length'],
    'oblong': ['Side Part', 'Layered Cut', 'Textured Top'],
    'diamond': ['Textured Fringe', 'Side Part', 'Pompadour'],
    'rectangle': ['Textured Crop', 'Messy Top', 'Fade con Volumen']
};

/**
 * Analizar rostro con Face++ API
 */
async function analyzeFaceWithFacePlusPlus(imageUrl) {
    const FACEPP_API_KEY = process.env.FACEPP_API_KEY;
    const FACEPP_API_SECRET = process.env.FACEPP_API_SECRET;

    if (!FACEPP_API_KEY || !FACEPP_API_SECRET) {
        // Si no hay credenciales, usar análisis simulado para desarrollo
        console.log('Face++ credentials not found, using simulated analysis');
        return simulateFaceAnalysis();
    }

    try {
        const formData = new URLSearchParams();
        formData.append('api_key', FACEPP_API_KEY);
        formData.append('api_secret', FACEPP_API_SECRET);
        formData.append('image_url', imageUrl);
        formData.append('return_attributes', 'faceshape');

        const response = await fetch('https://api-us.faceplusplus.com/facepp/v3/detect', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.faces && data.faces.length > 0) {
            const face = data.faces[0];
            const faceShape = face.attributes?.faceshape?.value || 'oval';
            return {
                faceShape: faceShape.toLowerCase(),
                confidence: face.attributes?.faceshape?.confidence || 85,
                faceRectangle: face.face_rectangle
            };
        }

        return simulateFaceAnalysis();
    } catch (error) {
        console.error('Error calling Face++ API:', error);
        return simulateFaceAnalysis();
    }
}

/**
 * Análisis simulado para desarrollo/testing
 */
function simulateFaceAnalysis() {
    const shapes = ['oval', 'round', 'square', 'heart', 'oblong'];
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    return {
        faceShape: randomShape,
        confidence: 75 + Math.random() * 20,
        simulated: true
    };
}

/**
 * Generar simulación con FAL.ai
 */
async function generateSimulationWithFalAI(originalImageUrl, haircutStyle) {
    const FAL_API_KEY = process.env.FAL_API_KEY;

    if (!FAL_API_KEY) {
        console.log('FAL.ai API key not found, skipping simulation');
        return null;
    }

    try {
        const response = await fetch('https://fal.run/fal-ai/face-to-sticker', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_url: originalImageUrl,
                prompt: `person with ${haircutStyle} haircut, professional barbershop result, realistic`,
                negative_prompt: 'blurry, distorted, ugly'
            })
        });

        const data = await response.json();
        return data.image?.url || null;
    } catch (error) {
        console.error('Error calling FAL.ai:', error);
        return null;
    }
}

/**
 * POST /facial-analysis - Analizar rostro y obtener recomendaciones
 */
export async function analyzeFace(req, res) {
    try {
        const userId = req.user.userId;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere una imagen para el análisis.'
            });
        }

        // 1. Subir imagen original a Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'barberia/facial-analysis' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(req.file.buffer);
        });

        const originalImageUrl = uploadResult.secure_url;

        // 2. Analizar rostro con Face++
        const faceAnalysis = await analyzeFaceWithFacePlusPlus(originalImageUrl);
        const faceShape = faceAnalysis.faceShape;

        // 3. Obtener recomendaciones basadas en la forma del rostro
        const recommendedStyles = FACE_SHAPE_RECOMMENDATIONS[faceShape] || FACE_SHAPE_RECOMMENDATIONS['oval'];

        // 4. Buscar cortes del catálogo que coincidan
        const haircuts = await prisma.haircut.findMany({
            where: {
                OR: recommendedStyles.map(style => ({
                    name: { contains: style, mode: 'insensitive' }
                }))
            },
            take: 3
        });

        // Si no hay suficientes cortes en el catálogo, obtener aleatorios
        let recommendations = haircuts;
        if (haircuts.length < 3) {
            const additionalHaircuts = await prisma.haircut.findMany({
                where: {
                    id: { notIn: haircuts.map(h => h.id) }
                },
                take: 3 - haircuts.length
            });
            recommendations = [...haircuts, ...additionalHaircuts];
        }

        // 5. Guardar análisis en la base de datos
        const analysis = await prisma.facialAnalysis.create({
            data: {
                userId,
                originalImage: originalImageUrl,
                faceShape,
                confidence: faceAnalysis.confidence,
                recommendations: JSON.stringify(recommendations.map(h => ({
                    id: h.id,
                    name: h.name,
                    imageUrl: h.imageUrl
                })))
            }
        });

        res.status(200).json({
            success: true,
            analysis: {
                id: analysis.id,
                originalImage: originalImageUrl,
                faceShape,
                faceShapeSpanish: getFaceShapeInSpanish(faceShape),
                confidence: Math.round(faceAnalysis.confidence),
                recommendations: recommendations.map(h => ({
                    id: h.id,
                    name: h.name,
                    description: h.description,
                    imageUrl: h.imageUrl
                })),
                simulated: faceAnalysis.simulated || false
            }
        });
    } catch (error) {
        console.error('Error en análisis facial:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al analizar el rostro.'
        });
    }
}

/**
 * POST /facial-analysis/:id/simulate - Generar simulaciones con FAL.ai
 */
export async function generateSimulations(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Verificar que el análisis existe y pertenece al usuario
        const analysis = await prisma.facialAnalysis.findFirst({
            where: { id, userId }
        });

        if (!analysis) {
            return res.status(404).json({
                success: false,
                message: 'Análisis no encontrado.'
            });
        }

        const recommendations = JSON.parse(analysis.recommendations);
        const simulations = [];

        // Generar simulación para cada corte recomendado
        for (let i = 0; i < Math.min(recommendations.length, 3); i++) {
            const haircut = recommendations[i];
            const simulationUrl = await generateSimulationWithFalAI(
                analysis.originalImage,
                haircut.name
            );

            if (simulationUrl) {
                // Subir simulación a Cloudinary para persistencia
                const uploadResult = await cloudinary.uploader.upload(simulationUrl, {
                    folder: 'barberia/simulations'
                });
                simulations.push({
                    haircutId: haircut.id,
                    haircutName: haircut.name,
                    simulationUrl: uploadResult.secure_url
                });
            }
        }

        // Actualizar análisis con las simulaciones
        const updateData = {};
        if (simulations[0]) updateData.simulation1 = simulations[0].simulationUrl;
        if (simulations[1]) updateData.simulation2 = simulations[1].simulationUrl;
        if (simulations[2]) updateData.simulation3 = simulations[2].simulationUrl;

        if (Object.keys(updateData).length > 0) {
            await prisma.facialAnalysis.update({
                where: { id },
                data: updateData
            });
        }

        res.status(200).json({
            success: true,
            simulations
        });
    } catch (error) {
        console.error('Error generando simulaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al generar simulaciones.'
        });
    }
}

/**
 * GET /facial-analysis/history - Obtener historial de análisis del usuario
 */
export async function getAnalysisHistory(req, res) {
    try {
        const userId = req.user.userId;

        const analyses = await prisma.facialAnalysis.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        res.status(200).json({
            success: true,
            analyses: analyses.map(a => ({
                id: a.id,
                originalImage: a.originalImage,
                faceShape: a.faceShape,
                faceShapeSpanish: getFaceShapeInSpanish(a.faceShape),
                confidence: Math.round(a.confidence),
                recommendations: JSON.parse(a.recommendations),
                simulations: [a.simulation1, a.simulation2, a.simulation3].filter(Boolean),
                createdAt: a.createdAt
            }))
        });
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener historial.'
        });
    }
}

/**
 * GET /facial-analysis/:id - Obtener un análisis específico
 */
export async function getAnalysisById(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const analysis = await prisma.facialAnalysis.findFirst({
            where: { id, userId }
        });

        if (!analysis) {
            return res.status(404).json({
                success: false,
                message: 'Análisis no encontrado.'
            });
        }

        res.status(200).json({
            success: true,
            analysis: {
                id: analysis.id,
                originalImage: analysis.originalImage,
                faceShape: analysis.faceShape,
                faceShapeSpanish: getFaceShapeInSpanish(analysis.faceShape),
                confidence: Math.round(analysis.confidence),
                recommendations: JSON.parse(analysis.recommendations),
                simulations: [analysis.simulation1, analysis.simulation2, analysis.simulation3].filter(Boolean),
                createdAt: analysis.createdAt
            }
        });
    } catch (error) {
        console.error('Error obteniendo análisis:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener análisis.'
        });
    }
}

/**
 * Traducir forma del rostro al español
 */
function getFaceShapeInSpanish(shape) {
    const translations = {
        'oval': 'Ovalado',
        'round': 'Redondo',
        'square': 'Cuadrado',
        'heart': 'Corazón',
        'oblong': 'Oblongo',
        'diamond': 'Diamante',
        'rectangle': 'Rectangular'
    };
    return translations[shape] || shape;
}

export default {
    analyzeFace,
    generateSimulations,
    getAnalysisHistory,
    getAnalysisById
};
