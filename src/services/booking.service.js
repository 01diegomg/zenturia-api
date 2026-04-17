// --- src/services/booking.service.js ---
import { prisma } from '../config/database.js';
import * as emailService from './email.service.js';

/**
 * Create an appointment
 * Usa transacción atómica para prevenir condiciones de carrera (empalme de citas)
 */
export async function createAppointment({ dateKey, serviceId, barberId, time, userEmail }) {
    const requestedDateTime = new Date(`${dateKey}T${time}:00`);

    // Primero obtenemos los datos necesarios fuera de la transacción
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const barber = await prisma.barber.findUnique({ where: { id: barberId } });

    if (!user || !service) {
        const error = new Error('Usuario o servicio no encontrado.');
        error.statusCode = 404;
        throw error;
    }

    if (!barber) {
        const error = new Error('Barbero no encontrado.');
        error.statusCode = 404;
        throw error;
    }

    const serviceDuration = service.duration || 30; // duración en minutos
    const slotStart = requestedDateTime;
    const slotEnd = new Date(requestedDateTime.getTime() + serviceDuration * 60 * 1000);

    // TRANSACCIÓN ATÓMICA: Verificación y creación en una sola operación
    // Esto previene condiciones de carrera cuando dos usuarios reservan al mismo tiempo
    try {
        const newAppointment = await prisma.$transaction(async (tx) => {
            // Dentro de la transacción, verificamos la disponibilidad
            // Buscar TODAS las citas del día para este barbero (con bloqueo implícito)
            const existingAppointments = await tx.appointment.findMany({
                where: {
                    barberId: barber.id,
                    status: { not: 'CANCELLED' },
                    date: {
                        gte: new Date(dateKey + 'T00:00:00'),
                        lte: new Date(dateKey + 'T23:59:59.999')
                    }
                },
                include: {
                    service: { select: { duration: true } }
                }
            });

            // Verificar cada cita existente para detectar empalmes
            for (const existingAppt of existingAppointments) {
                const existingStart = existingAppt.date;
                const existingDuration = existingAppt.service?.duration || 30;
                const existingEnd = new Date(existingStart.getTime() + existingDuration * 60 * 1000);

                // Verificar si hay empalme:
                // El nuevo slot empieza durante la cita existente O
                // El nuevo slot termina durante la cita existente O
                // La cita existente está completamente dentro del nuevo slot
                const overlaps = (
                    (slotStart >= existingStart && slotStart < existingEnd) || // Nuevo empieza durante existente
                    (slotEnd > existingStart && slotEnd <= existingEnd) ||     // Nuevo termina durante existente
                    (slotStart <= existingStart && slotEnd >= existingEnd)     // Nuevo envuelve existente
                );

                if (overlaps) {
                    const error = new Error('Este horario ya no está disponible. Por favor selecciona otro horario.');
                    error.statusCode = 409; // Conflict
                    throw error;
                }
            }

            // Si llegamos aquí, el horario está disponible - crear la cita dentro de la transacción
            const appointment = await tx.appointment.create({
                data: {
                    date: requestedDateTime,
                    userId: user.id,
                    serviceId: service.id,
                    barberId: barber.id
                }
            });

            return appointment;
        }, {
            maxWait: 5000, // Esperar máximo 5 segundos para obtener conexión
            timeout: 10000, // Timeout de la transacción: 10 segundos
        });

        // Send confirmation email (non-blocking, fuera de la transacción)
        emailService.sendAppointmentConfirmation(user, service, requestedDateTime, barber)
            .then(sent => {
                if (!sent) {
                    console.warn(`⚠️  Email de confirmación no enviado a ${user.email} para cita del ${requestedDateTime.toISOString()}`);
                }
            })
            .catch(err => {
                console.error(`❌ Error al enviar email de confirmación a ${user.email}:`, err.message);
            });

        return { appointment: newAppointment, user, service, barber };

    } catch (error) {
        // Si el error ya tiene statusCode (es nuestro error de validación), re-lanzarlo
        if (error.statusCode) {
            throw error;
        }
        // Para otros errores, envolver en un error genérico
        console.error('Error inesperado al crear cita:', error);
        const genericError = new Error('Error al crear la cita. Por favor intenta de nuevo.');
        genericError.statusCode = 500;
        throw genericError;
    }
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(appointmentId, cancelledBy = 'admin') {
    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
            user: { select: { name: true, email: true } },
            service: { select: { name: true } }
        }
    });

    if (!appointment) {
        const error = new Error('La cita no fue encontrada.');
        error.statusCode = 404;
        throw error;
    }

    const updatedAppointment = await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CANCELLED' }
    });

    // Send cancellation emails (non-blocking)
    const logEmailError = (type, email) => (err) => {
        console.error(`❌ Error al enviar email de ${type} a ${email}:`, err.message);
    };

    if (cancelledBy === 'client') {
        emailService.sendCancellationToClient(appointment.user, appointment.service, appointment.date)
            .catch(logEmailError('cancelación cliente', appointment.user.email));
        emailService.sendCancellationToAdmin(appointment.user, appointment.service, appointment.date)
            .catch(logEmailError('notificación admin', 'admin'));
    } else {
        emailService.sendAdminCancellationToClient(appointment.user, appointment.service, appointment.date)
            .catch(logEmailError('cancelación por admin', appointment.user.email));
    }

    return updatedAppointment;
}

/**
 * Get available slots for a specific date (business-wide, legacy support)
 */
export async function getAvailableSlots(date) {
    // Usar hora local consistentemente (sin 'Z' al final)
    const requestedDate = new Date(date + 'T00:00:00');

    let scheduleForDay = await prisma.scheduleOverride.findUnique({
        where: { date: requestedDate }
    });

    if (!scheduleForDay) {
        // Usar getDay() para hora local (no getUTCDay())
        const dayOfWeek = requestedDate.getDay();
        scheduleForDay = await prisma.workSchedule.findUnique({
            where: { dayOfWeek }
        });
    }

    if (!scheduleForDay || scheduleForDay.isDayOff) {
        return [];
    }

    let workingHours;
    try {
        workingHours = JSON.parse(scheduleForDay.workingHours);
    } catch (parseError) {
        console.error('Error al parsear workingHours:', parseError);
        return [];
    }

    if (!Array.isArray(workingHours)) {
        console.error('workingHours no es un array válido');
        return [];
    }

    const allPossibleSlots = new Set();

    workingHours.forEach(interval => {
        if (!interval || !interval.start || !interval.end) {
            return;
        }
        let currentTime = new Date(`${date}T${interval.start}:00`);
        const endTime = new Date(`${date}T${interval.end}:00`);
        while (currentTime < endTime) {
            allPossibleSlots.add(currentTime.toTimeString().substring(0, 5));
            currentTime.setMinutes(currentTime.getMinutes() + 30);
        }
    });

    // Usar hora local consistentemente (sin 'Z' al final)
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59.999');

    const existingAppointments = await prisma.appointment.findMany({
        where: {
            date: { gte: startOfDay, lte: endOfDay },
            status: { not: 'CANCELLED' }
        },
        include: {
            service: { select: { duration: true } }
        }
    });

    // Build a set of blocked time ranges considering service duration
    const blockedRanges = existingAppointments.map(app => {
        const startTime = app.date;
        const duration = app.service?.duration || 30; // Default 30 min if no duration
        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
        return { start: startTime, end: endTime };
    });

    // Filter out slots that would overlap with existing appointments
    return [...allPossibleSlots].filter(slotTime => {
        const slotDate = new Date(`${date}T${slotTime}:00`);
        for (const range of blockedRanges) {
            if (slotDate >= range.start && slotDate < range.end) {
                return false;
            }
        }
        return true;
    });
}

/**
 * Get available slots for a specific barber on a specific date
 */
export async function getAvailableSlotsForBarber(date, barberId) {
    const requestedDate = new Date(date + 'T00:00:00');
    const dayOfWeek = requestedDate.getDay();

    // Check for barber-specific override first
    let scheduleForDay = await prisma.barberScheduleOverride.findUnique({
        where: {
            barberId_date: {
                barberId,
                date: requestedDate
            }
        }
    });

    // Fall back to barber's regular schedule
    if (!scheduleForDay) {
        scheduleForDay = await prisma.barberSchedule.findUnique({
            where: {
                barberId_dayOfWeek: {
                    barberId,
                    dayOfWeek
                }
            }
        });
    }

    // If no barber-specific schedule, fall back to business schedule
    if (!scheduleForDay) {
        scheduleForDay = await prisma.scheduleOverride.findUnique({
            where: { date: requestedDate }
        });

        if (!scheduleForDay) {
            scheduleForDay = await prisma.workSchedule.findUnique({
                where: { dayOfWeek }
            });
        }
    }

    if (!scheduleForDay || scheduleForDay.isDayOff) {
        return [];
    }

    let workingHours;
    try {
        workingHours = JSON.parse(scheduleForDay.workingHours);
    } catch (parseError) {
        console.error('Error al parsear workingHours:', parseError);
        return [];
    }

    if (!Array.isArray(workingHours) || workingHours.length === 0) {
        return [];
    }

    const allPossibleSlots = new Set();

    workingHours.forEach(interval => {
        if (!interval || !interval.start || !interval.end) {
            return;
        }
        let currentTime = new Date(`${date}T${interval.start}:00`);
        const endTime = new Date(`${date}T${interval.end}:00`);
        while (currentTime < endTime) {
            allPossibleSlots.add(currentTime.toTimeString().substring(0, 5));
            currentTime.setMinutes(currentTime.getMinutes() + 30);
        }
    });

    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59.999');

    // Only get appointments for this specific barber, including service duration
    const existingAppointments = await prisma.appointment.findMany({
        where: {
            barberId,
            date: { gte: startOfDay, lte: endOfDay },
            status: { not: 'CANCELLED' }
        },
        include: {
            service: { select: { duration: true } }
        }
    });

    // Build a set of blocked time ranges considering service duration
    const blockedRanges = existingAppointments.map(app => {
        const startTime = app.date;
        const duration = app.service?.duration || 30; // Default 30 min if no duration
        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
        return { start: startTime, end: endTime };
    });

    // Filter out slots that would overlap with existing appointments
    const availableSlots = [...allPossibleSlots].filter(slotTime => {
        const slotDate = new Date(`${date}T${slotTime}:00`);
        // Check if this slot overlaps with any blocked range
        for (const range of blockedRanges) {
            // A slot is blocked if it falls within an existing appointment's time range
            if (slotDate >= range.start && slotDate < range.end) {
                return false; // Slot is blocked
            }
        }
        return true; // Slot is available
    }).sort();

    return availableSlots;
}

/**
 * Get all appointments (with optional pagination)
 * @param {Object} options - Pagination options
 * @param {number} options.page - Page number (1-based)
 * @param {number} options.limit - Items per page
 * @param {string} options.status - Filter by status ('CONFIRMED', 'CANCELLED', 'all')
 * @param {boolean} options.upcoming - Only show upcoming appointments
 */
export async function getAllAppointments(options = {}) {
    const { page, limit, status = 'all', upcoming = false } = options;

    // Build where clause
    const where = {};
    if (status !== 'all') {
        where.status = status;
    }
    if (upcoming) {
        where.date = { gte: new Date() };
    }

    // If pagination is requested
    if (page && limit) {
        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const total = await prisma.appointment.count({ where });

        // Get paginated appointments
        const appointments = await prisma.appointment.findMany({
            where,
            include: {
                user: { select: { name: true, email: true } },
                service: { select: { name: true } },
                barber: { select: { name: true, photo: true } }
            },
            orderBy: { date: 'asc' },
            skip,
            take: limit
        });

        const formattedAppointments = formatAppointments(appointments);

        return {
            appointments: formattedAppointments,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            }
        };
    }

    // No pagination - return all appointments (legacy behavior)
    const appointments = await prisma.appointment.findMany({
        where,
        include: {
            user: { select: { name: true, email: true } },
            service: { select: { name: true } },
            barber: { select: { name: true, photo: true } }
        },
        orderBy: { date: 'asc' }
    });

    return formatAppointments(appointments);
}

/**
 * Helper function to format appointments into grouped object
 */
function formatAppointments(appointments) {
    const formattedAppointments = {};
    appointments.forEach(app => {
        const dateKey = app.date.toISOString().split('T')[0];
        if (!formattedAppointments[dateKey]) {
            formattedAppointments[dateKey] = [];
        }
        formattedAppointments[dateKey].push({
            id: app.id,
            dateKey: dateKey,
            time: app.date.toTimeString().substring(0, 5),
            serviceName: app.service.name,
            userName: app.user.name,
            userEmail: app.user.email,
            barberName: app.barber?.name || 'Sin asignar',
            barberPhoto: app.barber?.photo || '',
            status: app.status
        });
    });
    return formattedAppointments;
}

/**
 * Get appointments for a specific user
 */
export async function getUserAppointments(userId) {
    return prisma.appointment.findMany({
        where: { userId },
        include: {
            service: { select: { name: true, price: true, duration: true } },
            barber: { select: { name: true, photo: true } }
        },
        orderBy: { date: 'desc' }
    });
}

/**
 * Busca los próximos días con horarios disponibles
 * @param {string} startDate - Fecha de inicio (YYYY-MM-DD)
 * @param {number} daysToSearch - Cantidad de días a buscar (default: 14)
 * @param {number} maxResults - Máximo de días con disponibilidad a devolver (default: 5)
 * @returns {Promise<Array>} Array de días con disponibilidad
 */
export async function getNextAvailableDays(startDate, daysToSearch = 14, maxResults = 5) {
    const results = [];
    const start = new Date(startDate + 'T00:00:00');

    for (let i = 0; i < daysToSearch && results.length < maxResults; i++) {
        const checkDate = new Date(start);
        checkDate.setDate(start.getDate() + i);

        // Saltar días pasados
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (checkDate < today) continue;

        const dateKey = checkDate.toISOString().split('T')[0];

        try {
            const slots = await getAvailableSlots(dateKey);

            if (slots.length > 0) {
                results.push({
                    date: dateKey,
                    dayName: checkDate.toLocaleDateString('es-ES', { weekday: 'long' }),
                    dayNumber: checkDate.getDate(),
                    month: checkDate.toLocaleDateString('es-ES', { month: 'short' }),
                    availableSlots: slots.length,
                    firstSlot: slots[0],
                    lastSlot: slots[slots.length - 1]
                });
            }
        } catch (error) {
            console.error(`Error al verificar disponibilidad para ${dateKey}:`, error);
        }
    }

    return results;
}

export default {
    createAppointment,
    cancelAppointment,
    getAvailableSlots,
    getAvailableSlotsForBarber,
    getAllAppointments,
    getUserAppointments,
    getNextAvailableDays
};
