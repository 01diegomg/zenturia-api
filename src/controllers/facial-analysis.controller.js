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
 * Si Face++ no está configurado, intenta detectar usando la forma manual del usuario
 */
async function analyzeFaceWithFacePlusPlus(imageUrl, manualFaceShape = null) {
    const FACEPP_API_KEY = process.env.FACEPP_API_KEY;
    const FACEPP_API_SECRET = process.env.FACEPP_API_SECRET;

    // Si el usuario proporcionó su forma de rostro manualmente, usarla
    if (manualFaceShape && ['oval', 'round', 'square', 'heart', 'oblong', 'diamond', 'rectangle'].includes(manualFaceShape.toLowerCase())) {
        console.log(`[Face Analysis] Using manual face shape: ${manualFaceShape}`);
        return {
            success: true,
            faceShape: manualFaceShape.toLowerCase(),
            confidence: 100,
            manual: true
        };
    }

    if (!FACEPP_API_KEY || !FACEPP_API_SECRET) {
        console.log('[Face++] Credentials not found, using smart default analysis');
        return getSmartDefaultAnalysis();
    }

    return withRetry(async () => {
        console.log('[Face++] Calling API...');
        const formData = new URLSearchParams();
        formData.append('api_key', FACEPP_API_KEY);
        formData.append('api_secret', FACEPP_API_SECRET);
        formData.append('image_url', imageUrl);
        formData.append('return_attributes', 'faceshape');

        const response = await fetch('https://api-cn.faceplusplus.com/facepp/v3/detect', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.error_message) {
            console.error('[Face++] API error:', data.error_message);

            // Si es error de cuota o credenciales, usar análisis por defecto
            if (data.error_message.includes('AUTHORIZATION') ||
                data.error_message.includes('quota') ||
                data.error_message.includes('limit')) {
                console.log('[Face++] Authorization/quota issue, using default');
                return getSmartDefaultAnalysis();
            }

            throw new Error(data.error_message);
        }

        if (data.faces && data.faces.length > 0) {
            const face = data.faces[0];
            const faceShape = face.attributes?.faceshape?.value || 'oval';
            console.log(`[Face++] Detected shape: ${faceShape}`);
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
            message: 'No se detectó ningún rostro en la imagen. Asegúrate de que tu cara esté bien iluminada y visible.'
        };
    }, 'Face++ Analysis');
}

/**
 * Análisis por defecto inteligente cuando Face++ no está disponible
 * Usa 'oval' que es la forma más común y funciona con la mayoría de cortes
 */
function getSmartDefaultAnalysis() {
    return {
        success: true,
        faceShape: 'oval', // Forma más versátil
        confidence: 80,
        simulated: true,
        note: 'Análisis basado en forma promedio. Para resultados más precisos, selecciona tu forma de rostro manualmente.'
    };
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
 * Generar simulación con Replicate - Versión optimizada
 * Intenta múltiples estrategias para máxima compatibilidad
 */
async function generateSimulationWithReplicate(originalImageUrl, haircutStyle) {
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

    if (!REPLICATE_API_TOKEN) {
        console.log('[Replicate] No token configured, trying FAL.ai');
        return generateSimulationWithFalAI(originalImageUrl, haircutStyle);
    }

    console.log(`[Replicate] Token found (${REPLICATE_API_TOKEN.length} chars), starting generation for: ${haircutStyle}`);

    // Estrategia 1: Intentar con IP-Adapter Face ID (preserva identidad)
    try {
        const result = await tryIPAdapterFaceID(originalImageUrl, haircutStyle, REPLICATE_API_TOKEN);
        if (result) return result;
    } catch (e) {
        console.log(`[Replicate] IP-Adapter failed: ${e.message}`);
    }

    // Estrategia 2: Intentar con SDXL Lightning (rápido, genera imagen de referencia)
    try {
        const result = await generateSimulationWithSDXL(haircutStyle, REPLICATE_API_TOKEN);
        if (result) return result;
    } catch (e) {
        console.log(`[Replicate] SDXL Lightning failed: ${e.message}`);
    }

    // Estrategia 3: FAL.ai como último recurso
    return generateSimulationWithFalAI(originalImageUrl, haircutStyle);
}

/**
 * IP-Adapter Face ID - Preserva identidad facial usando PhotoMaker
 */
async function tryIPAdapterFaceID(originalImageUrl, haircutStyle, token) {
    console.log(`[IP-Adapter] Generating for: ${haircutStyle}`);

    const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'wait'
        },
        body: JSON.stringify({
            // tencentarc/photomaker - modelo estable para retratos con estilo
            version: "ddfc2b08d209f9fa8c1eca692712918bd449f695dabb4a958da31802a9570fe4",
            input: {
                input_image: originalImageUrl,
                style_name: "Photographic (Default)",
                prompt: `img, professional portrait photo, man with ${haircutStyle} haircut, barbershop quality, studio lighting, high quality, photorealistic`,
                negative_prompt: "blurry, ugly, deformed, cartoon, anime, low quality, bad anatomy, watermark",
                num_steps: 20,
                style_strength_ratio: 20,
                num_outputs: 1,
                guidance_scale: 5
            }
        })
    });

    const prediction = await response.json();

    if (prediction.detail) {
        console.log(`[IP-Adapter] API Error: ${prediction.detail}`);
        if (prediction.detail.includes('does not exist') || prediction.detail.includes('not found')) {
            return null;
        }
        throw new Error(prediction.detail);
    }

    // Si usó Prefer: wait, puede venir directo el resultado
    if (prediction.status === 'succeeded' && prediction.output) {
        const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        console.log(`[IP-Adapter] SUCCESS (direct): ${url.substring(0, 60)}...`);
        return url;
    }

    if (!prediction.urls?.get) {
        console.log('[IP-Adapter] No polling URL');
        return null;
    }

    // Polling
    let result = prediction;
    for (let i = 0; i < 90; i++) {
        if (result.status === 'succeeded' || result.status === 'failed' || result.status === 'canceled') break;
        await sleep(1000);
        try {
            const statusRes = await fetch(result.urls.get, {
                headers: { 'Authorization': `Token ${token}` }
            });
            result = await statusRes.json();
        } catch (e) {
            console.log(`[IP-Adapter] Polling error: ${e.message}`);
        }
        if (i > 0 && i % 20 === 0) console.log(`[IP-Adapter] Polling ${i}s: ${result.status}`);
    }

    if (result.status === 'succeeded' && result.output) {
        const url = Array.isArray(result.output) ? result.output[0] : result.output;
        console.log(`[IP-Adapter] SUCCESS: ${url.substring(0, 60)}...`);
        return url;
    }

    console.log(`[IP-Adapter] Final status: ${result.status}`, result.error || '');
    return null;
}

/**
 * SDXL Lightning - Generación rápida de imágenes de referencia
 * Genera una imagen de cómo se ve el corte (no preserva identidad)
 */
async function generateSimulationWithSDXL(haircutStyle, token) {
    console.log(`[SDXL] Generating reference image for: ${haircutStyle}`);

    // Lista de modelos a intentar (del más nuevo al más estable)
    const modelsToTry = [
        {
            name: 'SDXL Lightning',
            // bytedance/sdxl-lightning-4step - versión actual verificada
            version: "727e49a643e999d602a896c774a0658ffefea21465756a6ce24b7ea4165fffcd",
            input: {
                prompt: `professional barbershop portrait photo, handsome man with ${haircutStyle} haircut, clean shaven, studio lighting, high quality, 4k, photorealistic, front view face`,
                negative_prompt: 'blurry, ugly, deformed, cartoon, anime, bad quality, distorted, watermark, text',
                width: 1024,
                height: 1024,
                num_inference_steps: 4,
                scheduler: "K_EULER"
            }
        },
        {
            name: 'Stable Diffusion XL',
            // stability-ai/sdxl - versión actual verificada
            version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
            input: {
                prompt: `professional barbershop portrait, man with ${haircutStyle} haircut, studio lighting, photorealistic`,
                negative_prompt: 'blurry, ugly, cartoon',
                width: 1024,
                height: 1024,
                num_inference_steps: 25,
                guidance_scale: 7.5
            }
        }
    ];

    for (const model of modelsToTry) {
        try {
            console.log(`[SDXL] Trying ${model.name}...`);

            const response = await fetch('https://api.replicate.com/v1/predictions', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    version: model.version,
                    input: model.input
                })
            });

            const prediction = await response.json();

            if (prediction.detail) {
                console.log(`[SDXL] ${model.name} error: ${prediction.detail}`);
                continue; // Intentar siguiente modelo
            }

            if (!prediction.urls?.get) {
                console.log(`[SDXL] ${model.name} no polling URL`);
                continue;
            }

            // Polling
            let result = prediction;
            for (let i = 0; i < 60; i++) {
                if (result.status === 'succeeded' || result.status === 'failed' || result.status === 'canceled') break;
                await sleep(1000);
                try {
                    const statusRes = await fetch(result.urls.get, {
                        headers: { 'Authorization': `Token ${token}` }
                    });
                    result = await statusRes.json();
                } catch (e) {
                    // Ignorar errores de polling
                }

                if (i > 0 && i % 15 === 0) {
                    console.log(`[SDXL] ${model.name} polling ${i}s: ${result.status}`);
                }
            }

            if (result.status === 'succeeded' && result.output) {
                const url = Array.isArray(result.output) ? result.output[0] : result.output;
                console.log(`[SDXL] ${model.name} SUCCESS: ${url.substring(0, 50)}...`);
                return url;
            }

            console.log(`[SDXL] ${model.name} failed: ${result.status}`);
        } catch (error) {
            console.log(`[SDXL] ${model.name} exception: ${error.message}`);
        }
    }

    console.log('[SDXL] All models failed');
    return null;
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
    const startTime = Date.now();
    let step = 'init';

    try {
        const userId = req.user.userId;
        step = 'auth';
        console.log(`[Analysis] Starting for user ${userId}`);

        if (!req.file) {
            console.log(`[Analysis] ERROR: No file received`);
            return res.status(400).json({
                success: false,
                message: 'Se requiere una imagen para el análisis.'
            });
        }

        console.log(`[Analysis] File received: ${req.file.originalname}, size: ${req.file.size} bytes, mimetype: ${req.file.mimetype}`);

        // 1. Subir imagen a Cloudinary
        step = 'cloudinary_upload';
        console.log(`[Analysis] Step 1: Uploading to Cloudinary...`);

        let uploadResult;
        try {
            uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'barberia/facial-analysis',
                        transformation: [
                            { quality: 'auto:best' },
                            { fetch_format: 'auto' }
                        ]
                    },
                    (error, result) => {
                        if (error) {
                            console.error(`[Analysis] Cloudinary error:`, error);
                            reject(error);
                        } else {
                            resolve(result);
                        }
                    }
                );
                uploadStream.end(req.file.buffer);
            });
        } catch (cloudinaryError) {
            console.error(`[Analysis] Cloudinary upload failed:`, cloudinaryError);
            return res.status(500).json({
                success: false,
                message: 'Error al subir la imagen. Verifica la configuración de Cloudinary.',
                error: cloudinaryError.message
            });
        }

        const originalImageUrl = uploadResult.secure_url;
        console.log(`[Analysis] Step 1 DONE: Image uploaded in ${Date.now() - startTime}ms: ${originalImageUrl}`);

        // 2. Analizar rostro con Face++ (o usar forma manual si se proporciona)
        step = 'facepp_analysis';
        const manualFaceShape = req.body?.faceShape || null;
        const hairType = req.body?.hairType || null;
        const hairThickness = req.body?.hairThickness || null;

        console.log(`[Analysis] Step 2: Analyzing face...`);
        console.log(`[Analysis] Manual face shape provided: ${manualFaceShape || 'none'}`);
        console.log(`[Analysis] Hair type: ${hairType}, Thickness: ${hairThickness}`);

        let faceAnalysis;
        try {
            faceAnalysis = await analyzeFaceWithFacePlusPlus(originalImageUrl, manualFaceShape);
        } catch (faceppError) {
            console.error(`[Analysis] Face analysis failed:`, faceppError);
            // No fallar, usar análisis por defecto
            faceAnalysis = getSmartDefaultAnalysis();
        }

        console.log(`[Analysis] Step 2 DONE: Result:`, JSON.stringify(faceAnalysis));

        if (!faceAnalysis.success) {
            return res.status(400).json({
                success: false,
                error: faceAnalysis.error,
                message: faceAnalysis.message
            });
        }

        const faceShape = faceAnalysis.faceShape;

        console.log(`[Analysis] Face shape: ${faceShape}, Hair type: ${hairType}, Thickness: ${hairThickness}`);

        // 3. Obtener recomendaciones ajustadas
        step = 'recommendations';
        const recommendedStyles = getAdjustedRecommendations(faceShape, hairType, hairThickness);
        console.log(`[Analysis] Recommended styles: ${recommendedStyles.join(', ')}`);

        // 4. Buscar cortes del catálogo
        step = 'db_query';
        console.log(`[Analysis] Step 4: Querying haircuts from database...`);

        let haircuts = [];
        try {
            haircuts = await prisma.haircut.findMany({
                where: {
                    OR: recommendedStyles.map(style => ({
                        name: { contains: style, mode: 'insensitive' }
                    }))
                },
                take: 3
            });
        } catch (dbError) {
            console.error(`[Analysis] Database query failed:`, dbError);
            // Continue with empty haircuts - will use defaults
        }

        console.log(`[Analysis] Found ${haircuts.length} matching haircuts`);

        let recommendations = haircuts;
        if (haircuts.length < 3) {
            try {
                const additionalHaircuts = await prisma.haircut.findMany({
                    where: { id: { notIn: haircuts.map(h => h.id) } },
                    take: 3 - haircuts.length
                });
                recommendations = [...haircuts, ...additionalHaircuts];
            } catch (e) {
                console.log(`[Analysis] Additional haircuts query failed, using defaults`);
            }
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
        step = 'db_save';
        console.log(`[Analysis] Step 5: Saving analysis to database...`);

        let analysis;
        try {
            analysis = await prisma.facialAnalysis.create({
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
        } catch (saveError) {
            console.error(`[Analysis] Failed to save analysis:`, saveError);
            return res.status(500).json({
                success: false,
                message: 'Error al guardar el análisis en la base de datos.',
                error: saveError.message
            });
        }

        const totalTime = Date.now() - startTime;
        console.log(`[Analysis] COMPLETED in ${totalTime}ms: ${analysis.id} - ${faceShape}`);

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
        const totalTime = Date.now() - startTime;
        console.error(`[Analysis] FATAL ERROR at step '${step}' after ${totalTime}ms:`, error);
        console.error(`[Analysis] Error stack:`, error.stack);
        res.status(500).json({
            success: false,
            message: `Error del servidor al analizar el rostro (paso: ${step}).`,
            error: error.message
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
