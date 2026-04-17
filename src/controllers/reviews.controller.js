// --- src/controllers/reviews.controller.js ---
import { prisma } from '../config/database.js';

/**
 * Create a review for a completed appointment
 */
export async function createReview(req, res) {
    try {
        const { appointmentId, rating, comment } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado.'
            });
        }

        if (!appointmentId || !rating) {
            return res.status(400).json({
                success: false,
                message: 'appointmentId y rating son requeridos.'
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'El rating debe ser entre 1 y 5.'
            });
        }

        // Verificar que la cita existe y pertenece al usuario
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { user: true }
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Cita no encontrada.'
            });
        }

        if (appointment.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para reseñar esta cita.'
            });
        }

        if (appointment.status !== 'COMPLETED') {
            return res.status(400).json({
                success: false,
                message: 'Solo puedes reseñar citas completadas.'
            });
        }

        // Verificar si ya existe una reseña
        const existingReview = await prisma.review.findUnique({
            where: { appointmentId }
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'Ya has dejado una reseña para esta cita.'
            });
        }

        // Crear la reseña
        const review = await prisma.review.create({
            data: {
                appointmentId,
                rating,
                comment: comment || null
            }
        });

        res.status(201).json({
            success: true,
            message: 'Reseña creada exitosamente.',
            review
        });

    } catch (error) {
        console.error('Error al crear reseña:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear la reseña.'
        });
    }
}

/**
 * Get reviews summary (for admin dashboard)
 */
export async function getReviewsSummary(req, res) {
    try {
        const { period } = req.query; // today, week, month

        let dateFilter = {};
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (period) {
            case 'today':
                dateFilter = { gte: today };
                break;
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                dateFilter = { gte: weekAgo };
                break;
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                dateFilter = { gte: monthAgo };
                break;
            default:
                dateFilter = {};
        }

        const reviews = await prisma.review.findMany({
            where: dateFilter.gte ? { createdAt: dateFilter } : {},
            include: {
                appointment: {
                    include: {
                        user: { select: { name: true } },
                        service: { select: { name: true, price: true } },
                        barber: { select: { name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calcular estadisticas
        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
            : 0;

        const ratingDistribution = {
            5: reviews.filter(r => r.rating === 5).length,
            4: reviews.filter(r => r.rating === 4).length,
            3: reviews.filter(r => r.rating === 3).length,
            2: reviews.filter(r => r.rating === 2).length,
            1: reviews.filter(r => r.rating === 1).length,
        };

        res.json({
            success: true,
            summary: {
                totalReviews,
                averageRating: Math.round(averageRating * 10) / 10,
                ratingDistribution
            },
            reviews: reviews.map(r => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                createdAt: r.createdAt,
                userName: r.appointment.user.name,
                serviceName: r.appointment.service.name,
                barberName: r.appointment.barber.name
            }))
        });

    } catch (error) {
        console.error('Error al obtener resumen de reseñas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener reseñas.'
        });
    }
}

/**
 * Get dashboard stats (revenue + reviews in real-time)
 */
export async function getDashboardStats(req, res) {
    try {
        const { period } = req.query; // today, week, month

        let dateFilter = {};
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (period) {
            case 'today':
                dateFilter = { gte: today };
                break;
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                dateFilter = { gte: weekAgo };
                break;
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                dateFilter = { gte: monthAgo };
                break;
            default:
                dateFilter = {};
        }

        // Obtener citas completadas con sus servicios
        const completedAppointments = await prisma.appointment.findMany({
            where: {
                status: 'COMPLETED',
                ...(dateFilter.gte ? { date: dateFilter } : {})
            },
            include: {
                service: { select: { name: true, price: true } },
                barber: { select: { name: true } },
                review: true
            }
        });

        // Calcular ingresos
        const revenue = completedAppointments.reduce((sum, apt) => sum + (apt.service?.price || 0), 0);

        // Obtener todas las citas del periodo
        const allAppointments = await prisma.appointment.findMany({
            where: dateFilter.gte ? { date: dateFilter } : {}
        });

        const stats = {
            total: allAppointments.length,
            completed: allAppointments.filter(a => a.status === 'COMPLETED').length,
            confirmed: allAppointments.filter(a => a.status === 'CONFIRMED').length,
            pending: allAppointments.filter(a => a.status === 'PENDING').length,
            cancelled: allAppointments.filter(a => a.status === 'CANCELLED').length,
        };

        // Obtener reseñas
        const reviews = await prisma.review.findMany({
            where: dateFilter.gte ? { createdAt: dateFilter } : {},
            include: {
                appointment: {
                    include: {
                        user: { select: { name: true } },
                        service: { select: { name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10 // Ultimas 10 reseñas
        });

        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
            : 0;

        // Servicios mas populares (solo completados)
        const serviceStats = {};
        completedAppointments.forEach(apt => {
            const serviceName = apt.service?.name || 'Otro';
            if (!serviceStats[serviceName]) {
                serviceStats[serviceName] = { count: 0, revenue: 0 };
            }
            serviceStats[serviceName].count += 1;
            serviceStats[serviceName].revenue += apt.service?.price || 0;
        });

        const topServices = Object.entries(serviceStats)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([name, data]) => ({ name, ...data }));

        res.json({
            success: true,
            revenue,
            stats,
            reviews: {
                total: totalReviews,
                average: Math.round(averageRating * 10) / 10,
                recent: reviews.map(r => ({
                    id: r.id,
                    rating: r.rating,
                    comment: r.comment,
                    userName: r.appointment.user.name,
                    serviceName: r.appointment.service.name,
                    createdAt: r.createdAt
                }))
            },
            topServices,
            completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
        });

    } catch (error) {
        console.error('Error al obtener stats del dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadisticas.'
        });
    }
}

export default {
    createReview,
    getReviewsSummary,
    getDashboardStats
};
