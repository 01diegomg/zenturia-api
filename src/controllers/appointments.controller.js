// --- src/controllers/appointments.controller.js ---
import * as bookingService from '../services/booking.service.js';

/**
 * Get all appointments (with optional pagination)
 *
 * Query parameters:
 * - page: Page number (1-based) - optional
 * - limit: Items per page - optional
 * - status: Filter by status ('CONFIRMED', 'CANCELLED', 'all') - optional
 * - upcoming: Only show upcoming appointments (true/false) - optional
 *
 * DISPARADORES EN TERMINAL:
 * - "GET /appointments - Request received" -> Se recibió una petición para obtener citas
 * - "GET /appointments - Appointments found: X days" -> Citas encontradas
 * - "Error en GET /appointments:" -> Error al obtener citas
 */
export async function getAllAppointments(req, res) {
    // DISPARADOR: Indica que se recibió una petición GET /appointments
    console.log('GET /appointments - Request received');
    try {
        // Parse pagination parameters
        const page = req.query.page ? parseInt(req.query.page, 10) : null;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
        const status = req.query.status || 'all';
        const upcoming = req.query.upcoming === 'true';

        // Validate pagination params
        if (page !== null && (isNaN(page) || page < 1)) {
            return res.status(400).json({ success: false, message: 'El parámetro page debe ser un número mayor a 0.' });
        }
        if (limit !== null && (isNaN(limit) || limit < 1 || limit > 100)) {
            return res.status(400).json({ success: false, message: 'El parámetro limit debe ser un número entre 1 y 100.' });
        }

        const result = await bookingService.getAllAppointments({ page, limit, status, upcoming });

        // Check if result includes pagination metadata
        if (result.pagination) {
            console.log(`GET /appointments - Page ${page}/${result.pagination.totalPages}, ${result.pagination.total} total appointments`);
            res.status(200).json(result);
        } else {
            // Legacy response (no pagination)
            console.log('GET /appointments - Appointments found:', Object.keys(result).length, 'days');
            res.status(200).json(result);
        }
    } catch (error) {
        // DISPARADOR: Muestra el error ocurrido al obtener citas
        console.error("Error en GET /appointments:", error);
        res.status(500).json({ success: false, message: 'Error al obtener las citas.' });
    }
}

/**
 * Get available slots for a date
 *
 * DISPARADOR EN TERMINAL:
 * - "Error en /appointments/available-slots para fecha X:" -> Error al calcular disponibilidad
 */
export async function getAvailableSlots(req, res) {
    const { date, barberId } = req.query;
    if (!date) {
        return res.status(400).json({ success: false, message: 'La fecha es requerida.' });
    }
    try {
        let availableSlots;
        if (barberId) {
            availableSlots = await bookingService.getAvailableSlotsForBarber(date, barberId);
        } else {
            availableSlots = await bookingService.getAvailableSlots(date);
        }
        res.json(availableSlots);
    } catch (error) {
        // DISPARADOR: Muestra el error al calcular slots disponibles para una fecha
        console.error(`Error en /appointments/available-slots para fecha ${date}:`, error);
        res.status(500).json({ success: false, message: "Error del servidor al calcular disponibilidad." });
    }
}

/**
 * Create a new appointment
 *
 * DISPARADOR EN TERMINAL:
 * - "Error en POST /appointments/create:" -> Error al crear una cita
 */
export async function createAppointment(req, res) {
    try {
        const { dateKey, serviceId, barberId, time, userEmail } = req.body;

        // Validar campos requeridos
        if (!dateKey || !serviceId || !barberId || !time || !userEmail) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos: dateKey, serviceId, barberId, time, userEmail.'
            });
        }

        // Validar que la fecha sea válida
        const requestedDate = new Date(`${dateKey}T${time}:00`);
        if (isNaN(requestedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'La fecha u hora proporcionada no es válida.'
            });
        }

        // Validar que la fecha sea futura
        const now = new Date();
        if (requestedDate <= now) {
            return res.status(400).json({
                success: false,
                message: 'No se pueden crear citas en fechas pasadas.'
            });
        }

        const result = await bookingService.createAppointment({ dateKey, serviceId, barberId, time, userEmail });
        res.status(201).json({
            success: true,
            message: '¡Tu cita ha sido confirmada con éxito!',
            appointment: result.appointment,
            barber: result.barber
        });
    } catch (error) {
        // DISPARADOR: Muestra el error ocurrido al crear una cita
        console.error("Error en POST /appointments/create:", error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Error al crear la cita.'
        });
    }
}

/**
 * Cancel an appointment
 *
 * DISPARADOR EN TERMINAL:
 * - "Error al cancelar la cita:" -> Error al cancelar una cita
 */
export async function cancelAppointment(req, res) {
    try {
        const { id } = req.params;
        const { cancelledBy } = req.query;

        // Validar el parámetro cancelledBy
        const validCancelledBy = ['client', 'admin'];
        const sanitizedCancelledBy = validCancelledBy.includes(cancelledBy) ? cancelledBy : 'admin';

        await bookingService.cancelAppointment(id, sanitizedCancelledBy);
        res.status(200).json({ success: true, message: 'Cita cancelada con éxito.' });
    } catch (error) {
        // DISPARADOR: Muestra el error ocurrido al cancelar una cita
        console.error('Error al cancelar la cita:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Error del servidor al cancelar la cita.'
        });
    }
}

/**
 * Get user's own appointments
 */
export async function getMyAppointments(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
        }
        const appointments = await bookingService.getUserAppointments(req.user.userId);
        res.status(200).json({ success: true, appointments });
    } catch (error) {
        console.error("Error en GET /appointments/my:", error);
        res.status(500).json({ success: false, message: 'Error al obtener las citas.' });
    }
}

/**
 * Get next available days with slots
 *
 * Query parameters:
 * - startDate: Fecha de inicio (YYYY-MM-DD) - default: hoy
 * - days: Cantidad de días a buscar (default: 14, max: 30)
 * - maxResults: Máximo de resultados (default: 5, max: 10)
 */
export async function getNextAvailableDays(req, res) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const startDate = req.query.startDate || today;
        const days = Math.min(parseInt(req.query.days) || 14, 30);
        const maxResults = Math.min(parseInt(req.query.maxResults) || 5, 10);

        const availableDays = await bookingService.getNextAvailableDays(startDate, days, maxResults);

        res.status(200).json({
            success: true,
            startDate,
            daysSearched: days,
            availableDays
        });
    } catch (error) {
        console.error('Error en GET /appointments/next-available:', error);
        res.status(500).json({
            success: false,
            message: 'Error al buscar días disponibles.'
        });
    }
}

export default {
    getAllAppointments,
    getAvailableSlots,
    createAppointment,
    cancelAppointment,
    getMyAppointments,
    getNextAvailableDays
};
