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

// Ajustes de recomendaciones según tipo de cabello
const HAIR_TYPE_ADJUSTMENTS = {
    'straight': {
        // Cabello lacio: cualquier corte funciona bien
        preferred: ['Fade', 'Pompadour', 'Side Part', 'Undercut', 'Slick Back'],
        avoid: []
    },
    'wavy': {
        // Cabello ondulado: cortes con textura
        preferred: ['Textured', 'Messy', 'Medium Length', 'Layered', 'Quiff'],
        avoid: ['Slick Back']
    },
    'curly': {
        // Cabello rizado: mantener volumen arriba
        preferred: ['Curly Top', 'Taper Fade', 'High Top', 'Fringe', 'Natural'],
        avoid: ['Pompadour', 'Slick Back', 'Crew Cut corto']
    },
    'coily': {
        // Cabello afro: cortes que respeten la textura
        preferred: ['Afro', 'High Top Fade', 'Taper', 'Twist Out', 'Freeform'],
        avoid: ['Pompadour', 'Side Part tradicional']
    }
};

// Ajustes según grosor del cabello
const HAIR_THICKNESS_ADJUSTMENTS = {
    'thin': {
        // Cabello fino: cortes que den volumen
        preferred: ['Textured', 'Layered', 'Messy', 'Fringe'],
        avoid: ['Undercut largo', 'Slick Back']
    },
    'medium': {
        // Cabello normal: cualquier corte funciona
        preferred: [],
        avoid: []
    },
    'thick': {
        // Cabello grueso: cortes con degradado
        preferred: ['Fade', 'Taper', 'Undercut', 'Textured Crop'],
        avoid: []
    }
};

/**
 * Obtener recomendaciones ajustadas por tipo de cabello
 */
function getAdjustedRecommendations(faceShape, hairType, hairThickness) {
    let recommendations = [...(FACE_SHAPE_RECOMMENDATIONS[faceShape] || FACE_SHAPE_RECOMMENDATIONS['oval'])];

    // Si tenemos información del tipo de cabello, ajustar
    if (hairType && HAIR_TYPE_ADJUSTMENTS[hairType]) {
        const hairAdjust = HAIR_TYPE_ADJUSTMENTS[hairType];
        // Filtrar cortes que no van bien con el tipo de cabello
        recommendations = recommendations.filter(cut => {
            const cutLower = cut.toLowerCase();
            return !hairAdjust.avoid.some(avoid => cutLower.includes(avoid.toLowerCase()));
        });
        // Agregar cortes preferidos si hay espacio
        if (recommendations.length < 3) {
            const preferred = hairAdjust.preferred.slice(0, 3 - recommendations.length);
            recommendations = [...recommendations, ...preferred];
        }
    }

    // Ajustar por grosor
    if (hairThickness && HAIR_THICKNESS_ADJUSTMENTS[hairThickness]) {
        const thickAdjust = HAIR_THICKNESS_ADJUSTMENTS[hairThickness];
        recommendations = recommendations.filter(cut => {
            const cutLower = cut.toLowerCase();
            return !thickAdjust.avoid.some(avoid => cutLower.includes(avoid.toLowerCase()));
        });
    }

    return recommendations.slice(0, 3);
}

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
                success: true,
                faceShape: faceShape.toLowerCase(),
                confidence: face.attributes?.faceshape?.confidence || 85,
                faceRectangle: face.face_rectangle
            };
        }

        // NO se detectó ningún rostro en la imagen
        return {
            success: false,
            error: 'NO_FACE_DETECTED',
            message: 'No se detectó ningún rostro en la imagen. Por favor, sube una foto donde se vea claramente tu cara.'
        };
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
        success: true,
        faceShape: randomShape,
        confidence: 75 + Math.random() * 20,
        simulated: true
    };
}

/**
 * Generar simulación con Replicate API (alternativa gratuita)
 */
async function generateSimulationWithReplicate(originalImageUrl, haircutStyle) {
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

    if (!REPLICATE_API_TOKEN) {
        console.log('Replicate API token not found, trying FAL.ai...');
        return generateSimulationWithFalAI(originalImageUrl, haircutStyle);
    }

    try {
        // Usar modelo de face-swap o imagen generativa
        const response = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // Modelo de generación de imágenes con referencia facial
                version: "a45f82a1382bed3c42f29e5bf6aefc97d19adcf8e10ec08f372bd3e0ed2a338e",
                input: {
                    image: originalImageUrl,
                    prompt: `professional photo of a man with ${haircutStyle} haircut, barbershop, clean cut, well groomed, high quality, realistic`,
                    negative_prompt: 'blurry, distorted, ugly, deformed, cartoon, anime',
                    num_inference_steps: 30,
                    guidance_scale: 7.5
                }
            })
        });

        const prediction = await response.json();

        if (prediction.error) {
            console.error('Replicate error:', prediction.error);
            return null;
        }

        // Esperar a que se complete la predicción
        let result = prediction;
        let attempts = 0;
        const maxAttempts = 60; // Máximo 60 segundos

        while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo

            const statusResponse = await fetch(result.urls.get, {
                headers: {
                    'Authorization': `Token ${REPLICATE_API_TOKEN}`
                }
            });
            result = await statusResponse.json();
            attempts++;
        }

        if (result.status === 'succeeded' && result.output) {
            // El output puede ser un array o un string
            const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            return outputUrl;
        }

        console.log('Replicate prediction did not succeed:', result.status);
        return null;
    } catch (error) {
        console.error('Error calling Replicate:', error);
        return null;
    }
}

/**
 * Generar simulación con FAL.ai (backup)
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

        // Verificar si se detectó un rostro
        if (!faceAnalysis.success) {
            return res.status(400).json({
                success: false,
                error: faceAnalysis.error,
                message: faceAnalysis.message || 'No se pudo detectar un rostro en la imagen.'
            });
        }

        const faceShape = faceAnalysis.faceShape;

        // Obtener tipo de cabello del body (enviado desde la app)
        const hairType = req.body?.hairType || null;
        const hairThickness = req.body?.hairThickness || null;

        // 3. Obtener recomendaciones ajustadas por forma de rostro Y tipo de cabello
        const recommendedStyles = getAdjustedRecommendations(faceShape, hairType, hairThickness);

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
 * POST /facial-analysis/:id/simulate - Generar simulaciones con Replicate/FAL.ai
 */
export async function generateSimulations(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Verificar si algún servicio de IA está configurado (Replicate o FAL.ai)
        const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
        const FAL_API_KEY = process.env.FAL_API_KEY;

        if (!REPLICATE_API_TOKEN && !FAL_API_KEY) {
            return res.status(200).json({
                success: true,
                simulations: [],
                message: 'El servicio de simulaciones no está configurado. Contacta al administrador.'
            });
        }

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

        // Verificar si ya tiene simulaciones generadas
        if (analysis.simulation1 || analysis.simulation2 || analysis.simulation3) {
            const existingSimulations = [];
            const recommendations = JSON.parse(analysis.recommendations);

            if (analysis.simulation1 && recommendations[0]) {
                existingSimulations.push({
                    haircutId: recommendations[0].id,
                    haircutName: recommendations[0].name,
                    simulationUrl: analysis.simulation1
                });
            }
            if (analysis.simulation2 && recommendations[1]) {
                existingSimulations.push({
                    haircutId: recommendations[1].id,
                    haircutName: recommendations[1].name,
                    simulationUrl: analysis.simulation2
                });
            }
            if (analysis.simulation3 && recommendations[2]) {
                existingSimulations.push({
                    haircutId: recommendations[2].id,
                    haircutName: recommendations[2].name,
                    simulationUrl: analysis.simulation3
                });
            }

            if (existingSimulations.length > 0) {
                return res.status(200).json({
                    success: true,
                    simulations: existingSimulations,
                    message: 'Simulaciones recuperadas del análisis previo.'
                });
            }
        }

        const recommendations = JSON.parse(analysis.recommendations);
        const simulations = [];

        // Generar simulación para cada corte recomendado
        for (let i = 0; i < Math.min(recommendations.length, 3); i++) {
            const haircut = recommendations[i];
            const simulationUrl = await generateSimulationWithReplicate(
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
