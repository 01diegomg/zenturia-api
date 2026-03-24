// --- src/services/sales.service.js ---
import { prisma } from '../config/database.js';

/**
 * Obtiene las estadísticas de ventas para un período determinado
 * @param {string} period - 'today', 'week', 'month', 'year', o 'custom'
 * @param {Date} customStart - Fecha de inicio personalizada (solo si period === 'custom')
 * @param {Date} customEnd - Fecha de fin personalizada (solo si period === 'custom')
 * @returns {Promise<Object>} Estadísticas de ventas
 */
export async function getSalesStats(period = 'today', customStart = null, customEnd = null) {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            break;
        case 'week':
            const dayOfWeek = now.getDay();
            startDate = new Date(now);
            startDate.setDate(now.getDate() - dayOfWeek);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'custom':
            startDate = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = customEnd ? new Date(customEnd) : now;
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    // Obtener todas las citas del período con sus servicios y usuarios
    const appointments = await prisma.appointment.findMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate
            }
        },
        include: {
            service: {
                select: { id: true, name: true, price: true, duration: true }
            },
            user: {
                select: { id: true, name: true, email: true }
            }
        },
        orderBy: { date: 'desc' }
    });

    // Clasificar citas
    const completedAppointments = appointments.filter(app =>
        app.status !== 'CANCELLED' && app.date <= now
    );
    const cancelledAppointments = appointments.filter(app => app.status === 'CANCELLED');
    const pendingAppointments = appointments.filter(app =>
        app.status !== 'CANCELLED' && app.date > now
    );

    // Calcular métricas
    let totalEarnings = 0;
    const serviceBreakdown = {};
    const uniqueClients = new Set();

    completedAppointments.forEach(app => {
        const price = app.service?.price || 0;
        totalEarnings += price;

        // Desglose por servicio
        const serviceId = app.service?.id || 'unknown';
        if (!serviceBreakdown[serviceId]) {
            serviceBreakdown[serviceId] = {
                id: serviceId,
                name: app.service?.name || 'Servicio Desconocido',
                count: 0,
                total: 0,
                price: price
            };
        }
        serviceBreakdown[serviceId].count++;
        serviceBreakdown[serviceId].total += price;

        // Clientes únicos
        if (app.user?.email) {
            uniqueClients.add(app.user.email);
        }
    });

    // Ticket promedio
    const avgTicket = completedAppointments.length > 0
        ? totalEarnings / completedAppointments.length
        : 0;

    // Servicio más popular
    const sortedServices = Object.values(serviceBreakdown).sort((a, b) => b.count - a.count);
    const topService = sortedServices[0] || null;

    // Últimas transacciones (máximo 10)
    const recentTransactions = appointments.slice(0, 10).map(app => ({
        id: app.id,
        serviceName: app.service?.name || 'Servicio',
        servicePrice: app.service?.price || 0,
        userName: app.user?.name || 'Cliente',
        userEmail: app.user?.email || '',
        date: app.date.toISOString(),
        time: app.date.toTimeString().substring(0, 5),
        status: app.status
    }));

    // Comparar con período anterior para calcular tendencias
    const periodDuration = endDate - startDate;
    const prevStartDate = new Date(startDate.getTime() - periodDuration);
    const prevEndDate = new Date(startDate.getTime() - 1);

    const prevAppointments = await prisma.appointment.findMany({
        where: {
            date: { gte: prevStartDate, lte: prevEndDate },
            status: { not: 'CANCELLED' }
        },
        include: {
            service: { select: { price: true } }
        }
    });

    const prevCompletedAppointments = prevAppointments.filter(app => app.date <= now);
    let prevTotalEarnings = 0;
    prevCompletedAppointments.forEach(app => {
        prevTotalEarnings += app.service?.price || 0;
    });

    // Calcular cambio porcentual
    const earningsChange = prevTotalEarnings > 0
        ? ((totalEarnings - prevTotalEarnings) / prevTotalEarnings) * 100
        : totalEarnings > 0 ? 100 : 0;

    const appointmentsChange = prevCompletedAppointments.length > 0
        ? ((completedAppointments.length - prevCompletedAppointments.length) / prevCompletedAppointments.length) * 100
        : completedAppointments.length > 0 ? 100 : 0;

    return {
        period: {
            name: period,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        },
        metrics: {
            totalEarnings: parseFloat(totalEarnings.toFixed(2)),
            earningsChange: parseFloat(earningsChange.toFixed(1)),
            completedAppointments: completedAppointments.length,
            appointmentsChange: parseFloat(appointmentsChange.toFixed(1)),
            totalAppointments: appointments.length,
            cancelledAppointments: cancelledAppointments.length,
            pendingAppointments: pendingAppointments.length,
            uniqueClients: uniqueClients.size,
            avgTicket: parseFloat(avgTicket.toFixed(2)),
            topService: topService ? {
                name: topService.name,
                count: topService.count,
                total: parseFloat(topService.total.toFixed(2))
            } : null
        },
        servicesBreakdown: sortedServices.map(s => ({
            id: s.id,
            name: s.name,
            count: s.count,
            total: parseFloat(s.total.toFixed(2)),
            price: parseFloat(s.price.toFixed(2))
        })),
        recentTransactions
    };
}

/**
 * Obtiene un resumen rápido de ventas del día actual
 * @returns {Promise<Object>} Resumen de ventas del día
 */
export async function getDailySummary() {
    return getSalesStats('today');
}

export default {
    getSalesStats,
    getDailySummary
};
