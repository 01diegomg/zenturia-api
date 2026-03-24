// --- src/controllers/content.controller.js ---
import { prisma } from '../config/database.js';

/**
 * Get all public content
 */
export async function getPublicContent(req, res) {
    try {
        const [services, schedule, gallery, siteContent] = await Promise.all([
            prisma.service.findMany({ orderBy: { name: 'asc' } }),
            prisma.workSchedule.findMany({ orderBy: { dayOfWeek: 'asc' } }),
            prisma.galleryImage.findMany({ orderBy: { createdAt: 'desc' } }),
            prisma.siteContent.findUnique({ where: { id: 'main' } })
        ]);

        if (!siteContent) {
            return res.status(404).json({
                success: false,
                message: 'El contenido principal del sitio no ha sido inicializado.'
            });
        }

        res.status(200).json({
            hero: {
                title: siteContent.heroTitle,
                subtitle: siteContent.heroSubtitle,
                backgroundType: siteContent.heroBackgroundType,
                backgroundValue: siteContent.heroBackgroundValue
            },
            about: {
                text: siteContent.aboutText,
                image: siteContent.aboutImage
            },
            location: {
                address: siteContent.locationAddress,
                schedule: siteContent.locationSchedule,
                mapUrl: siteContent.locationMapUrl
            },
            palette: {
                accent: siteContent.colorAccent,
                background: siteContent.colorBackground,
                textMain: siteContent.colorTextMain,
                textSubtle: siteContent.colorTextSubtle
            },
            business: {
                name: siteContent.businessName,
                logo: siteContent.businessLogo,
                phone: siteContent.businessPhone,
                whatsapp: siteContent.businessWhatsApp
            },
            social: {
                instagram: siteContent.socialInstagram,
                facebook: siteContent.socialFacebook,
                tiktok: siteContent.socialTiktok
            },
            isConfigured: siteContent.isConfigured,
            services,
            gallery,
            schedule
        });
    } catch (error) {
        console.error('Error al obtener contenido público:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al cargar contenido.'
        });
    }
}

/**
 * Get setup status (for wizard)
 */
export async function getSetupStatus(req, res) {
    try {
        const siteContent = await prisma.siteContent.findUnique({
            where: { id: 'main' },
            select: { isConfigured: true }
        });

        res.status(200).json({
            isConfigured: siteContent?.isConfigured || false
        });
    } catch (error) {
        console.error('Error al verificar estado de configuración:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor.'
        });
    }
}

/**
 * Initial setup (wizard) - No auth required for first-time setup
 */
export async function initialSetup(req, res) {
    try {
        const { businessName, businessPhone, businessWhatsApp, socialInstagram, socialFacebook, socialTiktok } = req.body;

        // Check if already configured
        const existing = await prisma.siteContent.findUnique({
            where: { id: 'main' },
            select: { isConfigured: true }
        });

        if (existing?.isConfigured) {
            return res.status(400).json({
                success: false,
                message: 'El sitio ya ha sido configurado. Use el panel de administración para hacer cambios.'
            });
        }

        // Validate required fields
        if (!businessName || businessName.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del negocio es obligatorio (mínimo 2 caracteres).'
            });
        }

        await prisma.siteContent.update({
            where: { id: 'main' },
            data: {
                businessName: businessName.trim(),
                businessPhone: businessPhone?.trim() || '',
                businessWhatsApp: businessWhatsApp?.trim() || '',
                socialInstagram: socialInstagram?.trim() || '',
                socialFacebook: socialFacebook?.trim() || '',
                socialTiktok: socialTiktok?.trim() || '',
                isConfigured: true
            }
        });

        res.status(200).json({
            success: true,
            message: 'Configuración inicial completada exitosamente.'
        });
    } catch (error) {
        console.error('Error en configuración inicial:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al guardar configuración.'
        });
    }
}

/**
 * Validate hex color format
 * @param {string} color - Color to validate
 * @returns {boolean} True if valid hex color
 */
function isValidHexColor(color) {
    if (typeof color !== 'string') return false;
    // Matches #RGB, #RRGGBB, #RGBA, #RRGGBBAA
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}

/**
 * Update color palette
 */
export async function updatePalette(req, res) {
    try {
        const { accent, background, textMain, textSubtle } = req.body;

        // Validar que todos los colores sean hexadecimales válidos
        const colors = { accent, background, textMain, textSubtle };
        const invalidColors = Object.entries(colors)
            .filter(([key, value]) => value && !isValidHexColor(value))
            .map(([key]) => key);

        if (invalidColors.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Colores inválidos: ${invalidColors.join(', ')}. Usa formato hexadecimal (#RGB, #RRGGBB).`
            });
        }

        await prisma.siteContent.update({
            where: { id: 'main' },
            data: {
                colorAccent: accent,
                colorBackground: background,
                colorTextMain: textMain,
                colorTextSubtle: textSubtle
            }
        });

        res.status(200).json({
            success: true,
            message: 'Paleta de colores actualizada.'
        });
    } catch (error) {
        console.error('Error al actualizar paleta:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar paleta.'
        });
    }
}

/**
 * Update hero texts
 */
export async function updateTexts(req, res) {
    try {
        const { heroTitle, heroSubtitle } = req.body;

        await prisma.siteContent.update({
            where: { id: 'main' },
            data: { heroTitle, heroSubtitle }
        });

        res.status(200).json({
            success: true,
            message: 'Textos del sitio actualizados.'
        });
    } catch (error) {
        console.error('Error al actualizar textos:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar textos.'
        });
    }
}

/**
 * Update about section
 */
export async function updateAbout(req, res) {
    try {
        const { text, image } = req.body;

        await prisma.siteContent.update({
            where: { id: 'main' },
            data: { aboutText: text, aboutImage: image }
        });

        res.status(200).json({
            success: true,
            message: 'Sección "Nuestra Esencia" actualizada.'
        });
    } catch (error) {
        console.error('Error al actualizar about:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar sección.'
        });
    }
}

/**
 * Update hero background
 */
export async function updateHeroBackground(req, res) {
    try {
        const { type, value } = req.body;

        await prisma.siteContent.update({
            where: { id: 'main' },
            data: {
                heroBackgroundType: type,
                heroBackgroundValue: value
            }
        });

        res.status(200).json({
            success: true,
            message: 'Fondo actualizado.'
        });
    } catch (error) {
        console.error('Error al actualizar fondo:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar fondo.'
        });
    }
}

/**
 * Update location
 */
export async function updateLocation(req, res) {
    try {
        const { address, schedule, mapUrl } = req.body;

        await prisma.siteContent.update({
            where: { id: 'main' },
            data: {
                locationAddress: address,
                locationSchedule: schedule,
                locationMapUrl: mapUrl
            }
        });

        res.status(200).json({
            success: true,
            message: 'Sección de Ubicación actualizada.'
        });
    } catch (error) {
        console.error('Error al actualizar ubicación:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar ubicación.'
        });
    }
}

/**
 * Update business info
 */
export async function updateBusiness(req, res) {
    try {
        const { name, logo, phone, whatsapp } = req.body;

        // Validate business name
        if (name && name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del negocio debe tener al menos 2 caracteres.'
            });
        }

        const updateData = {};
        if (name !== undefined) updateData.businessName = name.trim();
        if (logo !== undefined) updateData.businessLogo = logo.trim();
        if (phone !== undefined) updateData.businessPhone = phone.trim();
        if (whatsapp !== undefined) updateData.businessWhatsApp = whatsapp.trim();

        await prisma.siteContent.update({
            where: { id: 'main' },
            data: updateData
        });

        res.status(200).json({
            success: true,
            message: 'Información del negocio actualizada.'
        });
    } catch (error) {
        console.error('Error al actualizar negocio:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar información.'
        });
    }
}

/**
 * Update social media links
 */
export async function updateSocial(req, res) {
    try {
        const { instagram, facebook, tiktok } = req.body;

        await prisma.siteContent.update({
            where: { id: 'main' },
            data: {
                socialInstagram: instagram?.trim() || '',
                socialFacebook: facebook?.trim() || '',
                socialTiktok: tiktok?.trim() || ''
            }
        });

        res.status(200).json({
            success: true,
            message: 'Redes sociales actualizadas.'
        });
    } catch (error) {
        console.error('Error al actualizar redes sociales:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar redes sociales.'
        });
    }
}

// =============================================
// TESTIMONIAL CRUD FUNCTIONS
// =============================================

/**
 * Get all active testimonials (public)
 */
export async function getTestimonials(req, res) {
    try {
        const testimonials = await prisma.testimonial.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            testimonials
        });
    } catch (error) {
        console.error('Error al obtener testimonios:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener testimonios.'
        });
    }
}

/**
 * Get all testimonials including inactive (admin only)
 */
export async function getAllTestimonials(req, res) {
    try {
        const testimonials = await prisma.testimonial.findMany({
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            testimonials
        });
    } catch (error) {
        console.error('Error al obtener testimonios:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener testimonios.'
        });
    }
}

/**
 * Create a new testimonial
 */
export async function createTestimonial(req, res) {
    try {
        const { name, rating, text, avatar, verified, isActive } = req.body;

        if (!name || !text) {
            return res.status(400).json({
                success: false,
                message: 'El nombre y el texto del testimonio son requeridos.'
            });
        }

        const parsedRating = parseInt(rating, 10);
        if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            return res.status(400).json({
                success: false,
                message: 'La calificación debe ser un número entre 1 y 5.'
            });
        }

        const newTestimonial = await prisma.testimonial.create({
            data: {
                name: name.trim(),
                rating: parsedRating,
                text: text.trim(),
                avatar: avatar?.trim() || '',
                verified: verified === true,
                isActive: isActive !== false
            }
        });

        res.status(201).json({
            success: true,
            message: 'Testimonio creado.',
            testimonial: newTestimonial
        });
    } catch (error) {
        console.error('Error al crear testimonio:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al crear testimonio.'
        });
    }
}

/**
 * Update a testimonial
 */
export async function updateTestimonial(req, res) {
    try {
        const { id } = req.params;
        const { name, rating, text, avatar, verified, isActive } = req.body;

        if (!name || !text) {
            return res.status(400).json({
                success: false,
                message: 'El nombre y el texto del testimonio son requeridos.'
            });
        }

        const parsedRating = parseInt(rating, 10);
        if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            return res.status(400).json({
                success: false,
                message: 'La calificación debe ser un número entre 1 y 5.'
            });
        }

        const updatedTestimonial = await prisma.testimonial.update({
            where: { id },
            data: {
                name: name.trim(),
                rating: parsedRating,
                text: text.trim(),
                avatar: avatar?.trim() || '',
                verified: verified === true,
                isActive: isActive !== false
            }
        });

        res.status(200).json({
            success: true,
            message: 'Testimonio actualizado.',
            testimonial: updatedTestimonial
        });
    } catch (error) {
        console.error('Error al actualizar testimonio:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar testimonio.'
        });
    }
}

/**
 * Delete a testimonial
 */
export async function deleteTestimonial(req, res) {
    try {
        const { id } = req.params;

        await prisma.testimonial.delete({ where: { id } });

        res.status(200).json({
            success: true,
            message: 'Testimonio eliminado.'
        });
    } catch (error) {
        console.error('Error al eliminar testimonio:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al eliminar testimonio.'
        });
    }
}

export default {
    getPublicContent,
    getSetupStatus,
    initialSetup,
    updatePalette,
    updateTexts,
    updateAbout,
    updateHeroBackground,
    updateLocation,
    updateBusiness,
    updateSocial,
    getTestimonials,
    getAllTestimonials,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial
};
