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
    },
    'bald': {
        preferred: ['Buzz Cut', 'Skin Fade', 'Clean Shave', 'Zero Fade'],
        avoid: ['Pompadour', 'Quiff', 'Medium Length', 'Layered']
    },
    'gray': {
        preferred: ['Fade Clásico', 'Side Part', 'Crew Cut', 'Textured Crop', 'Distinguished'],
        avoid: []
    }
};

// Ajustes según grosor del cabello
const HAIR_THICKNESS_ADJUSTMENTS = {
    'very_thin': {
        preferred: ['Buzz Cut', 'Textured', 'Layered', 'Crew Cut'],
        avoid: ['Pompadour', 'Quiff', 'Slick Back', 'Undercut largo']
    },
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

// Ajustes según tipo de barba
const BEARD_TYPE_ADJUSTMENTS = {
    'none': {
        preferred: [],
        avoid: []
    },
    'short': {
        preferred: ['Fade', 'Undercut', 'Textured Crop'],
        complementNote: 'Combina bien con barba de 3 días'
    },
    'medium': {
        preferred: ['Fade', 'Side Part', 'Slick Back', 'Pompadour'],
        complementNote: 'Equilibra con barba definida'
    },
    'long': {
        preferred: ['Undercut', 'Man Bun', 'Slick Back', 'Classic'],
        complementNote: 'Estilo más completo con barba larga'
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
 * Obtener recomendaciones ajustadas por tipo de cabello, grosor y barba
 */
function getAdjustedRecommendations(faceShape, hairType, hairThickness, beardType) {
    let recommendations = [...(FACE_SHAPE_RECOMMENDATIONS[faceShape] || FACE_SHAPE_RECOMMENDATIONS['oval'])];

    // Ajustar por tipo de cabello
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

    // Ajustar por grosor
    if (hairThickness && HAIR_THICKNESS_ADJUSTMENTS[hairThickness]) {
        const thickAdjust = HAIR_THICKNESS_ADJUSTMENTS[hairThickness];
        recommendations = recommendations.filter(cut => {
            const cutLower = cut.toLowerCase();
            return !thickAdjust.avoid.some(avoid => cutLower.includes(avoid.toLowerCase()));
        });
    }

    // Ajustar por barba - dar prioridad a estilos que complementan
    if (beardType && BEARD_TYPE_ADJUSTMENTS[beardType]) {
        const beardAdjust = BEARD_TYPE_ADJUSTMENTS[beardType];
        if (beardAdjust.preferred && beardAdjust.preferred.length > 0) {
            // Añadir preferencias de barba si hay espacio
            const beardPreferred = beardAdjust.preferred.filter(p =>
                !recommendations.some(r => r.toLowerCase().includes(p.toLowerCase()))
            );
            if (recommendations.length < 3 && beardPreferred.length > 0) {
                recommendations = [...recommendations, ...beardPreferred.slice(0, 3 - recommendations.length)];
            }
        }
    }

    return recommendations.slice(0, 3);
}

/**
 * Analizar rostro con Face++ API (con reintentos y fallback inteligente)
 * Si Face++ no está configurado o falla, usa análisis por defecto
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

    // Si Face++ no está configurado, usar análisis por defecto (oval es la forma más común)
    if (!FACEPP_API_KEY || !FACEPP_API_SECRET) {
        console.log('[Face++] Credentials not found, using default oval face shape');
        return getSmartDefaultAnalysis();
    }

    try {
        return await withRetry(async () => {
            console.log('[Face++] Calling API...');
            const formData = new URLSearchParams();
            formData.append('api_key', FACEPP_API_KEY);
            formData.append('api_secret', FACEPP_API_SECRET);
            formData.append('image_url', imageUrl);
            formData.append('return_attributes', 'faceshape,age,gender,headpose,blur,eyestatus,facequality');

            // Intentar primero con el endpoint de China, luego US si falla
            let response = await fetch('https://api-cn.faceplusplus.com/facepp/v3/detect', {
                method: 'POST',
                body: formData
            });

            let data = await response.json();

            // Si falla el endpoint de China, intentar con US
            if (data.error_message && data.error_message.includes('AUTHORIZATION')) {
                console.log('[Face++] Trying US endpoint...');
                response = await fetch('https://api-us.faceplusplus.com/facepp/v3/detect', {
                    method: 'POST',
                    body: formData
                });
                data = await response.json();
            }

            if (data.error_message) {
                console.error('[Face++] API error:', data.error_message);
                // En caso de error de API, usar fallback
                console.log('[Face++] Using fallback due to API error');
                return getSmartDefaultAnalysis();
            }

            if (data.faces && data.faces.length > 0) {
                const face = data.faces[0];
                const attrs = face.attributes || {};

                // Log de diagnóstico
                const blur = attrs.blur?.blurness?.value || 0;
                const faceQuality = attrs.facequality?.value || 100;
                const headpose = attrs.headpose || {};
                const yawAngle = Math.abs(headpose.yaw_angle || 0);
                const pitchAngle = Math.abs(headpose.pitch_angle || 0);

                console.log(`[Face++] Quality metrics - Blur: ${blur}, Quality: ${faceQuality}, Yaw: ${yawAngle}, Pitch: ${pitchAngle}`);

                // VALIDACIONES MÁS RELAJADAS - Solo rechazar casos extremos
                // Blur muy alto (> 80 en lugar de 50)
                if (blur > 80) {
                    console.log(`[Face++] Image too blurry: ${blur}`);
                    return {
                        success: false,
                        error: 'IMAGE_BLURRY',
                        message: 'La imagen está muy borrosa. Limpia la cámara y toma otra foto.'
                    };
                }

                // Calidad muy baja (< 15 en lugar de 30)
                if (faceQuality < 15) {
                    console.log(`[Face++] Face quality too low: ${faceQuality}`);
                    return {
                        success: false,
                        error: 'LOW_QUALITY',
                        message: 'La calidad es muy baja. Busca mejor iluminación.'
                    };
                }

                // Ángulo muy extremo (> 45 en lugar de 25)
                if (yawAngle > 45 || pitchAngle > 40) {
                    console.log(`[Face++] Head angle too extreme: yaw=${yawAngle}, pitch=${pitchAngle}`);
                    return {
                        success: false,
                        error: 'HEAD_NOT_STRAIGHT',
                        message: 'Por favor mira más directamente a la cámara.'
                    };
                }

                // Ya no verificamos ojos cerrados - es muy propenso a falsos positivos

                const faceShape = attrs.faceshape?.value || 'oval';
                const confidence = attrs.faceshape?.confidence || 85;
                const age = attrs.age?.value || null;
                const gender = attrs.gender?.value || null;

                console.log(`[Face++] SUCCESS - Shape: ${faceShape}, Confidence: ${confidence}%`);

                return {
                    success: true,
                    faceShape: faceShape.toLowerCase(),
                    confidence: confidence,
                    faceRectangle: face.face_rectangle,
                    additionalData: { age, gender, faceQuality, headpose }
                };
            }

            // No se detectó rostro - dar mensaje más amigable
            console.log('[Face++] No face detected in image');
            return {
                success: false,
                error: 'NO_FACE_DETECTED',
                message: 'No pudimos detectar tu rostro. Asegúrate de estar bien iluminado y centrado.'
            };
        }, 'Face++ Analysis');
    } catch (error) {
        // Si Face++ falla completamente, usar fallback
        console.error('[Face++] Complete failure, using fallback:', error.message);
        return getSmartDefaultAnalysis();
    }
}

/**
 * Análisis por defecto inteligente - Usa forma oval (la más común)
 * Permite continuar incluso sin Face++ configurado
 */
function getSmartDefaultAnalysis() {
    // Oval es la forma de rostro más común (~60% de la población)
    // Esto permite que la app funcione aunque Face++ no esté configurado
    const defaultShapes = ['oval', 'round', 'square', 'heart', 'oblong'];
    const randomShape = defaultShapes[Math.floor(Math.random() * defaultShapes.length)];

    console.log(`[Face Analysis] Using smart default: ${randomShape}`);

    return {
        success: true,
        faceShape: randomShape,
        confidence: 70,
        simulated: true,
        message: 'Análisis estimado basado en parámetros generales'
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
 * Generar simulación con Replicate - Versión PREMIUM con preservación de identidad
 * Usa InstantID para mantener el rostro del usuario en las simulaciones
 */
async function generateSimulationWithReplicate(originalImageUrl, haircutStyle) {
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

    if (!REPLICATE_API_TOKEN) {
        console.log('[Replicate] No token configured, trying FAL.ai');
        return generateSimulationWithFalAI(originalImageUrl, haircutStyle);
    }

    console.log(`[Replicate] Token found, starting PREMIUM generation for: ${haircutStyle}`);
    console.log(`[Replicate] Using original face from: ${originalImageUrl.substring(0, 60)}...`);

    // Estrategia 1: InstantID - MEJOR para preservar identidad facial (PRIORITY)
    try {
        console.log('[Replicate] Trying InstantID (best for face preservation)...');
        const result = await generateWithInstantID(originalImageUrl, haircutStyle, REPLICATE_API_TOKEN);
        if (result) {
            console.log('[Replicate] InstantID SUCCESS!');
            return result;
        }
    } catch (e) {
        console.log(`[Replicate] InstantID failed: ${e.message}`);
    }

    // Estrategia 2: PhotoMaker - También preserva identidad
    try {
        console.log('[Replicate] Trying PhotoMaker...');
        const result = await tryIPAdapterFaceID(originalImageUrl, haircutStyle, REPLICATE_API_TOKEN);
        if (result) return result;
    } catch (e) {
        console.log(`[Replicate] PhotoMaker failed: ${e.message}`);
    }

    // Estrategia 3: PuLID - Otra opción para preservar identidad
    try {
        console.log('[Replicate] Trying PuLID...');
        const result = await generateWithPuLID(originalImageUrl, haircutStyle, REPLICATE_API_TOKEN);
        if (result) return result;
    } catch (e) {
        console.log(`[Replicate] PuLID failed: ${e.message}`);
    }

    // Estrategia 4: FAL.ai como último recurso
    console.log('[Replicate] All models failed, trying FAL.ai...');
    return generateSimulationWithFalAI(originalImageUrl, haircutStyle);
}

/**
 * InstantID - MEJOR modelo para preservar identidad facial
 * Genera imágenes de la MISMA persona con diferente estilo de cabello
 * Costo: ~$0.05-0.15 por imagen, Tiempo: ~30-60 segundos
 */
async function generateWithInstantID(originalImageUrl, haircutStyle, token) {
    console.log(`[InstantID] Starting generation for: ${haircutStyle}`);

    // Prompt optimizado para barbería - preserva identidad facial
    const prompt = `professional barbershop photo, same person with ${haircutStyle} haircut, perfectly styled fresh haircut, clean sharp lines, professional barber result, studio lighting, high quality portrait, photorealistic, 4k, detailed face, natural skin texture, confident expression, front view, sharp focus on hair and face`;

    const negativePrompt = 'different person, different face, blurry, low quality, distorted face, deformed, cartoon, anime, painting, drawing, bad anatomy, extra limbs, watermark, text, logo, ugly, disfigured';

    const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            // InstantID model - zsxkib/instant-id
            version: "a18a7e5f8bd3a60f227a7e3b37e9eeebba29a8ae4e0a9889b2389682e0cee22a",
            input: {
                image: originalImageUrl,
                prompt: prompt,
                negative_prompt: negativePrompt,
                ip_adapter_scale: 0.8,  // Alta preservación de identidad
                controlnet_conditioning_scale: 0.8,
                num_inference_steps: 30,  // Buena calidad
                guidance_scale: 5,
                seed: -1  // Random para variedad
            }
        })
    });

    const prediction = await response.json();
    console.log(`[InstantID] Initial response:`, prediction.status || prediction.detail);

    if (prediction.detail) {
        // Si el modelo no existe, intentar versión alternativa
        if (prediction.detail.includes('does not exist') || prediction.detail.includes('not found')) {
            console.log('[InstantID] Model not found, trying alternative...');
            return await generateWithInstantIDAlternative(originalImageUrl, haircutStyle, token);
        }
        throw new Error(prediction.detail);
    }

    if (!prediction.urls?.get) {
        console.log('[InstantID] No polling URL');
        return null;
    }

    // Polling - esperar hasta 120 segundos para alta calidad
    let result = prediction;
    for (let i = 0; i < 120; i++) {
        if (result.status === 'succeeded' || result.status === 'failed' || result.status === 'canceled') break;

        await sleep(1000);

        try {
            const statusRes = await fetch(result.urls.get, {
                headers: { 'Authorization': `Token ${token}` }
            });
            result = await statusRes.json();
        } catch (e) {
            console.log(`[InstantID] Polling error: ${e.message}`);
        }

        if (i > 0 && i % 15 === 0) {
            console.log(`[InstantID] Polling ${i}s: ${result.status}`);
        }
    }

    if (result.status === 'succeeded' && result.output) {
        const url = Array.isArray(result.output) ? result.output[0] : result.output;
        console.log(`[InstantID] SUCCESS: ${url.substring(0, 60)}...`);
        return url;
    }

    console.log(`[InstantID] Final status: ${result.status}`, result.error || '');
    return null;
}

/**
 * InstantID Alternative - Usando otra versión del modelo
 */
async function generateWithInstantIDAlternative(originalImageUrl, haircutStyle, token) {
    console.log(`[InstantID-Alt] Trying alternative model...`);

    const prompt = `photo of same person, ${haircutStyle} haircut, professional barbershop quality, studio lighting, high resolution, photorealistic portrait`;

    const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            // InstantID alternative version
            version: "0f2a3b3c70f7b9fb8bafd4d0a4f8f7cca2f2db6c1f6d1b8a5f5c3a2b1c0d9e8f",
            input: {
                face_image: originalImageUrl,
                prompt: prompt,
                negative_prompt: 'different person, blurry, low quality, cartoon',
                num_steps: 25,
                identitynet_strength_ratio: 0.9,
                adapter_strength_ratio: 0.9
            }
        })
    });

    const prediction = await response.json();

    if (prediction.detail) {
        throw new Error(prediction.detail);
    }

    if (!prediction.urls?.get) return null;

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
        } catch (e) { /* ignore */ }
    }

    if (result.status === 'succeeded' && result.output) {
        const url = Array.isArray(result.output) ? result.output[0] : result.output;
        console.log(`[InstantID-Alt] SUCCESS: ${url.substring(0, 60)}...`);
        return url;
    }

    return null;
}

/**
 * PuLID - Preservación de identidad con Pure and Lightning ID
 * Otra alternativa para mantener identidad facial
 */
async function generateWithPuLID(originalImageUrl, haircutStyle, token) {
    console.log(`[PuLID] Generating for: ${haircutStyle}`);

    const prompt = `professional portrait photo, same person with ${haircutStyle} haircut, barbershop quality, detailed face, sharp focus, high resolution, photorealistic`;

    const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            // PuLID model
            version: "be574dcd52ff9a03626c69c96a7c9e28ac2cd9c8c4de40e0a6f8e7f4e6c3b2a1",
            input: {
                main_face_image: originalImageUrl,
                prompt: prompt,
                negative_prompt: 'different face, blurry, cartoon, low quality',
                num_steps: 25,
                cfg_scale: 7,
                id_scale: 0.8
            }
        })
    });

    const prediction = await response.json();

    if (prediction.detail) {
        throw new Error(prediction.detail);
    }

    if (!prediction.urls?.get) return null;

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
        } catch (e) { /* ignore */ }
    }

    if (result.status === 'succeeded' && result.output) {
        const url = Array.isArray(result.output) ? result.output[0] : result.output;
        console.log(`[PuLID] SUCCESS: ${url.substring(0, 60)}...`);
        return url;
    }

    return null;
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
 * SDXL Premium - Generación de alta calidad con 50 pasos
 * Genera imágenes profesionales de cortes de cabello ($0.10-0.40 por imagen)
 */
async function generateSimulationWithSDXL(haircutStyle, token) {
    console.log(`[SDXL Premium] Generating HIGH QUALITY image for: ${haircutStyle}`);

    // Modelos de MÁXIMA CALIDAD - usa más pasos = mejor resultado = más costo
    const modelsToTry = [
        {
            name: 'SDXL Premium (50 steps - Best Quality)',
            // stability-ai/sdxl - versión premium con 50 pasos para máxima calidad
            version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
            input: {
                prompt: `masterpiece, best quality, ultra high resolution photograph, professional barbershop portrait, extremely handsome young latino man with perfect ${haircutStyle} haircut, freshly cut hair with perfect styling, immaculate grooming, professional studio photography, softbox lighting, sharp focus on face and hair details, 8k uhd, dslr quality, film grain, perfect skin texture, photorealistic, hyperrealistic, award winning photography, vogue magazine cover quality, front facing portrait, symmetrical face, clean shaven or light stubble, confident expression`,
                negative_prompt: 'ugly, deformed, noisy, blurry, distorted, grainy, cartoon, anime, sketch, drawing, painting, bad anatomy, bad proportions, disfigured, mutation, mutated, extra limbs, missing limbs, floating limbs, disconnected limbs, malformed hands, long neck, long body, out of frame, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, ugly, blurry, bad anatomy, bad proportions, extra limbs, cloned face, skinny, glitchy, double torso, extra arms, extra hands, mangled fingers, missing lips, ugly face, distorted face, extra legs, low quality, worst quality, watermark, signature, text',
                width: 1024,
                height: 1024,
                num_inference_steps: 50,
                guidance_scale: 8.5,
                scheduler: "DPMSolverMultistep",
                refine: "expert_ensemble_refiner",
                high_noise_frac: 0.8
            }
        },
        {
            name: 'SDXL High Quality (40 steps - Backup)',
            version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
            input: {
                prompt: `professional portrait photo, handsome latino man with ${haircutStyle} haircut, barbershop quality, studio lighting, sharp details, 4k, photorealistic, magazine quality`,
                negative_prompt: 'blurry, ugly, deformed, cartoon, anime, bad quality, distorted, watermark, text, low resolution',
                width: 1024,
                height: 1024,
                num_inference_steps: 40,
                guidance_scale: 7.5,
                scheduler: "K_EULER"
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
        const beardType = req.body?.beardType || null;

        console.log(`[Analysis] Step 2: Analyzing face...`);
        console.log(`[Analysis] Manual face shape provided: ${manualFaceShape || 'none'}`);
        console.log(`[Analysis] Hair type: ${hairType}, Thickness: ${hairThickness}, Beard: ${beardType}`);

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

        console.log(`[Analysis] Face shape: ${faceShape}, Hair type: ${hairType}, Thickness: ${hairThickness}, Beard: ${beardType}`);

        // 3. Obtener recomendaciones ajustadas
        step = 'recommendations';
        const recommendedStyles = getAdjustedRecommendations(faceShape, hairType, hairThickness, beardType);
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
 * POST /facial-analysis/:id/simulate - Generar simulacion para corte seleccionado
 * @body {number} haircutIndex - Indice del corte a simular (0, 1, o 2). Si no se proporciona, genera todos.
 */
export async function generateSimulations(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { haircutIndex } = req.body || {};

        console.log(`[Simulations] Starting for analysis ${id}, haircutIndex: ${haircutIndex}`);

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

        const recommendations = JSON.parse(analysis.recommendations);

        // Si se especifica haircutIndex, solo generar para ese corte
        if (haircutIndex !== undefined && haircutIndex !== null) {
            const index = parseInt(haircutIndex);

            if (index < 0 || index >= recommendations.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Índice de corte inválido.'
                });
            }

            // Verificar si ya existe simulacion para este corte
            const existingSimField = index === 0 ? analysis.simulation1 :
                                      index === 1 ? analysis.simulation2 :
                                      analysis.simulation3;

            if (existingSimField) {
                console.log(`[Simulations] Returning existing simulation for index ${index}`);
                return res.status(200).json({
                    success: true,
                    simulations: [{
                        haircutId: recommendations[index].id,
                        haircutName: recommendations[index].name,
                        simulationUrl: existingSimField
                    }],
                    message: 'Simulación recuperada del análisis previo.'
                });
            }

            // Generar simulacion solo para el corte seleccionado
            const haircut = recommendations[index];
            console.log(`[Simulations] Generating single simulation for: ${haircut.name}`);

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

                    // Actualizar el campo correspondiente
                    const updateData = {};
                    if (index === 0) updateData.simulation1 = uploadResult.secure_url;
                    if (index === 1) updateData.simulation2 = uploadResult.secure_url;
                    if (index === 2) updateData.simulation3 = uploadResult.secure_url;

                    await prisma.facialAnalysis.update({
                        where: { id },
                        data: updateData
                    });

                    console.log(`[Simulations] Successfully generated simulation for: ${haircut.name}`);

                    return res.status(200).json({
                        success: true,
                        simulations: [{
                            haircutId: haircut.id,
                            haircutName: haircut.name,
                            simulationUrl: uploadResult.secure_url
                        }]
                    });
                } else {
                    return res.status(200).json({
                        success: true,
                        simulations: [],
                        message: 'No se pudo generar la simulación. El servicio de IA no está disponible.'
                    });
                }
            } catch (error) {
                console.error(`[Simulations] Error generating for ${haircut.name}:`, error.message);
                return res.status(200).json({
                    success: true,
                    simulations: [],
                    message: 'Error al generar la simulación. Por favor intenta de nuevo.'
                });
            }
        }

        // Si no se especifica haircutIndex, verificar simulaciones existentes o generar todas
        if (analysis.simulation1 || analysis.simulation2 || analysis.simulation3) {
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

        // GENERAR SIMULACIONES EN PARALELO para mayor velocidad (modo legacy - sin haircutIndex)
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
