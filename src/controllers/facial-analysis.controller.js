// --- src/controllers/facial-analysis.controller.js ---
// Módulo IA Premium: Análisis Facial + Simulaciones con Face++ y Replicate/FAL.ai
import { prisma } from '../config/database.js';
import cloudinary from '../../cloudinaryConfig.js';

// Configuración de reintentos
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
};

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
        preferred: ['Fade', 'Pompadour', 'Side Part', 'Undercut', 'Slick Back'],
        avoid: []
    },
    'wavy': {
        preferred: ['Textured', 'Messy', 'Medium Length', 'Layered', 'Quiff'],
        avoid: ['Slick Back']
    },
    'curly': {
        preferred: ['Curly Top', 'Taper Fade', 'High Top', 'Fringe', 'Natural'],
        avoid: ['Pompadour', 'Slick Back', 'Crew Cut corto']
    },
    'coily': {
        preferred: ['Afro', 'High Top Fade', 'Taper', 'Twist Out', 'Freeform'],
        avoid: ['Pompadour', 'Side Part tradicional']
    }
};

// Ajustes según grosor del cabello
const HAIR_THICKNESS_ADJUSTMENTS = {
    'thin': {
        preferred: ['Textured', 'Layered', 'Messy', 'Fringe'],
        avoid: ['Undercut largo', 'Slick Back']
    },
    'medium': {
        preferred: [],
        avoid: []
    },
    'thick': {
        preferred: ['Fade', 'Taper', 'Undercut', 'Textured Crop'],
        avoid: []
    }
};

/**
 * Utilidad para esperar con delay
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ejecutar función con reintentos y backoff exponencial
 */
async function withRetry(fn, context = 'Operation') {
    let lastError;

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < RETRY_CONFIG.maxRetries) {
                const delay = Math.min(
                    RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
                    RETRY_CONFIG.maxDelay
                );
                console.log(`[${context}] Reintento ${attempt + 1}/${RETRY_CONFIG.maxRetries} en ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

/**
 * Obtener recomendaciones ajustadas por tipo de cabello
 */
function getAdjustedRecommendations(faceShape, hairType, hairThickness) {
    let recommendations = [...(FACE_SHAPE_RECOMMENDATIONS[faceShape] || FACE_SHAPE_RECOMMENDATIONS['oval'])];

    if (hairType && HAIR_TYPE_ADJUSTMENTS[hairType]) {
        const hairAdjust = HAIR_TYPE_ADJUSTMENTS[hairType];
        recommendations = recommendations.filter(cut => {
            const cutLower = cut.toLowerCase();
            return !hairAdjust.avoid.some(avoid => cutLower.includes(avoid.toLowerCase()));
        });
        if (recommendations.length < 3) {
            const preferred = hairAdjust.preferred.slice(0, 3 - recommendations.length);
            recommendations = [...recommendations, ...preferred];
        }
    }

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
 * Analizar rostro con Face++ API (con reintentos)
 */
async function analyzeFaceWithFacePlusPlus(imageUrl) {
    const FACEPP_API_KEY = process.env.FACEPP_API_KEY;
    const FACEPP_API_SECRET = process.env.FACEPP_API_SECRET;

    if (!FACEPP_API_KEY || !FACEPP_API_SECRET) {
        console.log('Face++ credentials not found, using simulated analysis');
        return simulateFaceAnalysis();
    }

    return withRetry(async () => {
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

        if (data.error_message) {
            console.error('Face++ API error:', data.error_message);
            throw new Error(data.error_message);
        }

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

        return {
            success: false,
            error: 'NO_FACE_DETECTED',
            message: 'No se detectó ningún rostro en la imagen.'
        };
    }, 'Face++ Analysis');
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
 * Generar simulación con Replicate API - Usando SDXL img2img para modificar cabello
 */
async function generateSimulationWithReplicate(originalImageUrl, haircutStyle) {
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

    if (!REPLICATE_API_TOKEN) {
        return generateSimulationWithFalAI(originalImageUrl, haircutStyle);
    }

    try {
        console.log(`[Replicate] Generating simulation for: ${haircutStyle} with image: ${originalImageUrl}`);

        // Usar lucataco/sdxl - modelo estable para img2img
        const response = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // SDXL by lucataco - estable y rápido
                version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
                input: {
                    image: originalImageUrl,
                    prompt: `professional portrait photo of the same person with ${haircutStyle} haircut, barbershop quality, well groomed, studio lighting, high quality, detailed face, same person same face`,
                    negative_prompt: 'different person, blurry, ugly, deformed, bad quality, distorted face, cartoon, anime',
                    strength: 0.35,
                    num_inference_steps: 30,
                    guidance_scale: 7.5
                }
            })
        });

        let prediction = await response.json();
        console.log(`[Replicate] Response status:`, response.status);
        console.log(`[Replicate] Response body:`, JSON.stringify(prediction).substring(0, 500));

        if (prediction.error || prediction.detail) {
            console.error('[Replicate] API error:', prediction.error || prediction.detail);
            // Si el modelo no existe, intentar con otro
            return await tryAlternativeModel(originalImageUrl, haircutStyle, REPLICATE_API_TOKEN);
        }

        if (!prediction.urls?.get) {
            console.error('[Replicate] Response missing urls:', JSON.stringify(prediction).substring(0, 300));
            return await tryAlternativeModel(originalImageUrl, haircutStyle, REPLICATE_API_TOKEN);
        }

        console.log(`[Replicate] Prediction started: ${prediction.id}`);

        // Esperar resultado con timeout
        let result = prediction;
        let attempts = 0;
        const maxAttempts = 180; // 3 minutos máximo

        while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
            await sleep(1000);

            const statusResponse = await fetch(result.urls.get, {
                headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` }
            });
            result = await statusResponse.json();
            attempts++;

            if (attempts % 30 === 0) {
                console.log(`[Replicate] Status after ${attempts}s: ${result.status}`);
            }
        }

        if (result.status === 'succeeded' && result.output) {
            const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            console.log(`[Replicate] Success for ${haircutStyle}: ${outputUrl}`);
            return outputUrl;
        }

        console.log(`[Replicate] Failed or timed out: ${result.status}`, result.error || '');
        return null;
    } catch (error) {
        console.error('[Replicate] Error:', error.message);
        return null;
    }
}

/**
 * Modelo alternativo si el principal falla
 */
async function tryAlternativeModel(originalImageUrl, haircutStyle, token) {
    console.log(`[Replicate] Trying alternative model for: ${haircutStyle}`);

    try {
        // Intentar con stability-ai/sdxl que es más estable
        const response = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // stability-ai/sdxl - modelo oficial muy estable
                version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
                input: {
                    prompt: `professional portrait photo of a person with ${haircutStyle} haircut, barbershop quality, studio lighting, high quality photograph`,
                    negative_prompt: 'blurry, ugly, deformed, bad quality',
                    num_inference_steps: 25,
                    guidance_scale: 7.5,
                    width: 768,
                    height: 1024
                }
            })
        });

        const prediction = await response.json();
        console.log(`[Replicate Alt] Response:`, JSON.stringify(prediction).substring(0, 300));

        if (!prediction.urls?.get) {
            console.error('[Replicate Alt] No prediction URL');
            return null;
        }

        // Esperar resultado
        let result = prediction;
        let attempts = 0;
        while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 120) {
            await sleep(1000);
            const statusResponse = await fetch(result.urls.get, {
                headers: { 'Authorization': `Token ${token}` }
            });
            result = await statusResponse.json();
            attempts++;
        }

        if (result.status === 'succeeded' && result.output) {
            const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            console.log(`[Replicate Alt] Success: ${outputUrl}`);
            return outputUrl;
        }

        return null;
    } catch (error) {
        console.error('[Replicate Alt] Error:', error.message);
        return null;
    }
}

/**
 * Generar simulación con FAL.ai (backup)
 */
async function generateSimulationWithFalAI(originalImageUrl, haircutStyle) {
    const FAL_API_KEY = process.env.FAL_API_KEY;

    if (!FAL_API_KEY) {
        console.log('[FAL.ai] API key not found');
        return null;
    }

    try {
        console.log(`[FAL.ai] Generating simulation for: ${haircutStyle}`);

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
        console.error('[FAL.ai] Error:', error.message);
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

        console.log(`[Analysis] Starting for user ${userId}`);

        // 1. Subir imagen a Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'barberia/facial-analysis',
                    transformation: [
                        { quality: 'auto:best' },
                        { fetch_format: 'auto' }
                    ]
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(req.file.buffer);
        });

        const originalImageUrl = uploadResult.secure_url;
        console.log(`[Analysis] Image uploaded: ${originalImageUrl}`);

        // 2. Analizar rostro con Face++
        const faceAnalysis = await analyzeFaceWithFacePlusPlus(originalImageUrl);

        if (!faceAnalysis.success) {
            return res.status(400).json({
                success: false,
                error: faceAnalysis.error,
                message: faceAnalysis.message
            });
        }

        const faceShape = faceAnalysis.faceShape;
        const hairType = req.body?.hairType || null;
        const hairThickness = req.body?.hairThickness || null;

        // 3. Obtener recomendaciones ajustadas
        const recommendedStyles = getAdjustedRecommendations(faceShape, hairType, hairThickness);

        // 4. Buscar cortes del catálogo
        const haircuts = await prisma.haircut.findMany({
            where: {
                OR: recommendedStyles.map(style => ({
                    name: { contains: style, mode: 'insensitive' }
                }))
            },
            take: 3
        });

        let recommendations = haircuts;
        if (haircuts.length < 3) {
            const additionalHaircuts = await prisma.haircut.findMany({
                where: { id: { notIn: haircuts.map(h => h.id) } },
                take: 3 - haircuts.length
            });
            recommendations = [...haircuts, ...additionalHaircuts];
        }

        // Si aún no hay suficientes, crear recomendaciones con nombres sugeridos
        if (recommendations.length < 3) {
            const missingCount = 3 - recommendations.length;
            const defaultRecs = recommendedStyles.slice(0, missingCount).map((name, i) => ({
                id: `suggested-${i}`,
                name: name,
                description: `Corte recomendado para rostro ${getFaceShapeInSpanish(faceShape).toLowerCase()}`,
                imageUrl: null
            }));
            recommendations = [...recommendations, ...defaultRecs];
        }

        // 5. Guardar análisis
        const analysis = await prisma.facialAnalysis.create({
            data: {
                userId,
                originalImage: originalImageUrl,
                faceShape,
                confidence: faceAnalysis.confidence,
                recommendations: JSON.stringify(recommendations.map(h => ({
                    id: h.id,
                    name: h.name,
                    imageUrl: h.imageUrl || null,
                    description: h.description || null
                })))
            }
        });

        console.log(`[Analysis] Completed: ${analysis.id} - ${faceShape}`);

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
                    description: h.description || null,
                    imageUrl: h.imageUrl || null
                })),
                simulated: faceAnalysis.simulated || false
            }
        });
    } catch (error) {
        console.error('[Analysis] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al analizar el rostro.'
        });
    }
}

/**
 * POST /facial-analysis/:id/simulate - Generar simulaciones en PARALELO
 */
export async function generateSimulations(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        console.log(`[Simulations] Starting for analysis ${id}`);

        // Verificar servicios de IA con logging detallado
        const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
        const FAL_API_KEY = process.env.FAL_API_KEY;

        console.log(`[Simulations] Config check:`);
        console.log(`  - REPLICATE_API_TOKEN: ${REPLICATE_API_TOKEN ? `configured (${REPLICATE_API_TOKEN.length} chars, prefix: ${REPLICATE_API_TOKEN.substring(0, 4)}...)` : 'NOT SET'}`);
        console.log(`  - FAL_API_KEY: ${FAL_API_KEY ? `configured (${FAL_API_KEY.length} chars)` : 'NOT SET'}`);

        if (!REPLICATE_API_TOKEN && !FAL_API_KEY) {
            console.log(`[Simulations] ERROR: Neither REPLICATE_API_TOKEN nor FAL_API_KEY is configured in environment variables`);
            return res.status(200).json({
                success: true,
                simulations: [],
                message: 'El servicio de simulaciones no está configurado. Por favor configure REPLICATE_API_TOKEN o FAL_API_KEY en las variables de entorno.'
            });
        }

        console.log(`[Simulations] Services available - proceeding with generation`);

        // Verificar análisis
        const analysis = await prisma.facialAnalysis.findFirst({
            where: { id, userId }
        });

        if (!analysis) {
            return res.status(404).json({
                success: false,
                message: 'Análisis no encontrado.'
            });
        }

        // Verificar simulaciones existentes
        if (analysis.simulation1 || analysis.simulation2 || analysis.simulation3) {
            const recommendations = JSON.parse(analysis.recommendations);
            const existingSimulations = [];

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
                console.log(`[Simulations] Returning ${existingSimulations.length} existing simulations`);
                return res.status(200).json({
                    success: true,
                    simulations: existingSimulations,
                    message: 'Simulaciones recuperadas del análisis previo.'
                });
            }
        }

        const recommendations = JSON.parse(analysis.recommendations);

        // GENERAR SIMULACIONES EN PARALELO para mayor velocidad
        console.log(`[Simulations] Generating ${recommendations.length} simulations in parallel...`);

        const simulationPromises = recommendations.slice(0, 3).map(async (haircut, index) => {
            try {
                const simulationUrl = await generateSimulationWithReplicate(
                    analysis.originalImage,
                    haircut.name
                );

                if (simulationUrl) {
                    // Subir a Cloudinary para persistencia
                    const uploadResult = await cloudinary.uploader.upload(simulationUrl, {
                        folder: 'barberia/simulations',
                        transformation: [{ quality: 'auto:good' }]
                    });

                    return {
                        index,
                        haircutId: haircut.id,
                        haircutName: haircut.name,
                        simulationUrl: uploadResult.secure_url
                    };
                }
                return null;
            } catch (error) {
                console.error(`[Simulations] Error for ${haircut.name}:`, error.message);
                return null;
            }
        });

        // Esperar todas las simulaciones en paralelo
        const results = await Promise.all(simulationPromises);
        const simulations = results.filter(r => r !== null);

        console.log(`[Simulations] Generated ${simulations.length} of ${recommendations.length}`);

        // Actualizar análisis con simulaciones
        const updateData = {};
        simulations.forEach(sim => {
            if (sim.index === 0) updateData.simulation1 = sim.simulationUrl;
            if (sim.index === 1) updateData.simulation2 = sim.simulationUrl;
            if (sim.index === 2) updateData.simulation3 = sim.simulationUrl;
        });

        if (Object.keys(updateData).length > 0) {
            await prisma.facialAnalysis.update({
                where: { id },
                data: updateData
            });
        }

        res.status(200).json({
            success: true,
            simulations: simulations.map(s => ({
                haircutId: s.haircutId,
                haircutName: s.haircutName,
                simulationUrl: s.simulationUrl
            }))
        });
    } catch (error) {
        console.error('[Simulations] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al generar simulaciones.'
        });
    }
}

/**
 * GET /facial-analysis/history - Obtener historial del usuario
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
                simulations: [a.simulation1, a.simulation2, a.simulation3].filter(Boolean).map((url, i) => ({
                    simulationUrl: url,
                    haircutName: JSON.parse(a.recommendations)[i]?.name || `Corte ${i + 1}`
                })),
                createdAt: a.createdAt
            }))
        });
    } catch (error) {
        console.error('[History] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener historial.'
        });
    }
}

/**
 * GET /facial-analysis/:id - Obtener análisis específico
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

        const recommendations = JSON.parse(analysis.recommendations);

        res.status(200).json({
            success: true,
            analysis: {
                id: analysis.id,
                originalImage: analysis.originalImage,
                faceShape: analysis.faceShape,
                faceShapeSpanish: getFaceShapeInSpanish(analysis.faceShape),
                confidence: Math.round(analysis.confidence),
                recommendations,
                simulations: [analysis.simulation1, analysis.simulation2, analysis.simulation3]
                    .filter(Boolean)
                    .map((url, i) => ({
                        simulationUrl: url,
                        haircutName: recommendations[i]?.name || `Corte ${i + 1}`
                    })),
                createdAt: analysis.createdAt
            }
        });
    } catch (error) {
        console.error('[GetAnalysis] Error:', error);
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
