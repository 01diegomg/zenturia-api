// --- src/controllers/barbers.controller.js ---
import { prisma } from '../config/database.js';

/**
 * Get all barbers (public)
 */
export async function getAllBarbers(req, res) {
    try {
        const barbers = await prisma.barber.findMany({
            where: { isActive: true },
            include: {
                schedules: true
            },
            orderBy: { name: 'asc' }
        });

        res.status(200).json({
            success: true,
            barbers
        });
    } catch (error) {
        console.error('Error al obtener barberos:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener barberos.'
        });
    }
}

/**
 * Get all barbers including inactive (admin only)
 */
export async function getAllBarbersAdmin(req, res) {
    try {
        const barbers = await prisma.barber.findMany({
            include: {
                schedules: true,
                _count: {
                    select: { appointments: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.status(200).json({
            success: true,
            barbers
        });
    } catch (error) {
        console.error('Error al obtener barberos:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener barberos.'
        });
    }
}

/**
 * Get a single barber by ID
 */
export async function getBarberById(req, res) {
    try {
        const { id } = req.params;

        const barber = await prisma.barber.findUnique({
            where: { id },
            include: {
                schedules: true,
                overrides: true
            }
        });

        if (!barber) {
            return res.status(404).json({
                success: false,
                message: 'Barbero no encontrado.'
            });
        }

        res.status(200).json({
            success: true,
            barber
        });
    } catch (error) {
        console.error('Error al obtener barbero:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener barbero.'
        });
    }
}

/**
 * Create a new barber
 */
export async function createBarber(req, res) {
    try {
        const { name, photo, specialties, isActive } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del barbero es requerido.'
            });
        }

        const newBarber = await prisma.barber.create({
            data: {
                name,
                photo: photo || '',
                specialties: JSON.stringify(specialties || []),
                isActive: isActive !== false
            }
        });

        // Create default schedule for the barber (Mon-Sat 9-18, Sun off)
        const defaultSchedule = Array.from({ length: 7 }, (_, i) => {
            const isOff = i === 0;
            const hours = isOff ? [] : [{ start: "09:00", end: "18:00" }];
            return {
                barberId: newBarber.id,
                dayOfWeek: i,
                workingHours: JSON.stringify(hours),
                isDayOff: isOff
            };
        });
        await prisma.barberSchedule.createMany({ data: defaultSchedule });

        const barberWithSchedule = await prisma.barber.findUnique({
            where: { id: newBarber.id },
            include: { schedules: true }
        });

        res.status(201).json({
            success: true,
            message: 'Barbero creado.',
            barber: barberWithSchedule
        });
    } catch (error) {
        console.error('Error al crear barbero:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al crear barbero.'
        });
    }
}

/**
 * Update a barber
 */
export async function updateBarber(req, res) {
    try {
        const { id } = req.params;
        const { name, photo, specialties, isActive } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del barbero es requerido.'
            });
        }

        const updatedBarber = await prisma.barber.update({
            where: { id },
            data: {
                name,
                photo: photo || '',
                specialties: typeof specialties === 'string' ? specialties : JSON.stringify(specialties || []),
                isActive: isActive !== false
            },
            include: { schedules: true }
        });

        res.status(200).json({
            success: true,
            message: 'Barbero actualizado.',
            barber: updatedBarber
        });
    } catch (error) {
        console.error('Error al actualizar barbero:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar barbero.'
        });
    }
}

/**
 * Delete a barber
 */
export async function deleteBarber(req, res) {
    try {
        const { id } = req.params;

        // Check if barber has future appointments
        const appointmentCount = await prisma.appointment.count({
            where: {
                barberId: id,
                status: 'CONFIRMED',
                date: { gte: new Date() }
            }
        });

        if (appointmentCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar un barbero con citas futuras. Cancela las citas primero o desactívalo.'
            });
        }

        await prisma.barber.delete({ where: { id } });

        res.status(200).json({
            success: true,
            message: 'Barbero eliminado.'
        });
    } catch (error) {
        console.error('Error al eliminar barbero:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al eliminar barbero.'
        });
    }
}

/**
 * Update barber schedule
 */
export async function updateBarberSchedule(req, res) {
    try {
        const { id } = req.params;
        const { schedules } = req.body;

        if (!Array.isArray(schedules)) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un array de horarios.'
            });
        }

        // Verify barber exists
        const barber = await prisma.barber.findUnique({ where: { id } });
        if (!barber) {
            return res.status(404).json({
                success: false,
                message: 'Barbero no encontrado.'
            });
        }

        // Update each schedule day
        for (const schedule of schedules) {
            await prisma.barberSchedule.upsert({
                where: {
                    barberId_dayOfWeek: {
                        barberId: id,
                        dayOfWeek: schedule.dayOfWeek
                    }
                },
                update: {
                    workingHours: typeof schedule.workingHours === 'string'
                        ? schedule.workingHours
                        : JSON.stringify(schedule.workingHours || []),
                    isDayOff: schedule.isDayOff || false
                },
                create: {
                    barberId: id,
                    dayOfWeek: schedule.dayOfWeek,
                    workingHours: typeof schedule.workingHours === 'string'
                        ? schedule.workingHours
                        : JSON.stringify(schedule.workingHours || []),
                    isDayOff: schedule.isDayOff || false
                }
            });
        }

        const updatedBarber = await prisma.barber.findUnique({
            where: { id },
            include: { schedules: true }
        });

        res.status(200).json({
            success: true,
            message: 'Horario del barbero actualizado.',
            barber: updatedBarber
        });
    } catch (error) {
        console.error('Error al actualizar horario del barbero:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar horario.'
        });
    }
}

/**
 * Get available barbers for a specific date
 */
export async function getAvailableBarbersForDate(req, res) {
    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere una fecha.'
            });
        }

        const targetDate = new Date(date + 'T12:00:00');
        const dayOfWeek = targetDate.getDay();

        // Create date range for override check
        const startOfDay = new Date(date + 'T00:00:00');
        const endOfDay = new Date(date + 'T23:59:59');

        // Get all active barbers with their schedules
        const barbers = await prisma.barber.findMany({
            where: { isActive: true },
            include: {
                schedules: {
                    where: { dayOfWeek }
                },
                overrides: {
                    where: {
                        date: {
                            gte: startOfDay,
                            lte: endOfDay
                        }
                    }
                }
            }
        });

        // Filter barbers who work on this date
        const availableBarbers = barbers.filter(barber => {
            // Check for override first
            if (barber.overrides.length > 0) {
                return !barber.overrides[0].isDayOff;
            }
            // Check regular schedule
            if (barber.schedules.length > 0) {
                return !barber.schedules[0].isDayOff;
            }
            // If no schedule defined, barber is available by default
            return true;
        });

        res.status(200).json({
            success: true,
            barbers: availableBarbers
        });
    } catch (error) {
        console.error('Error al obtener barberos disponibles:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener barberos disponibles.'
        });
    }
}

/**
 * Create schedule override for a barber
 */
export async function createBarberOverride(req, res) {
    try {
        const { id } = req.params;
        const { date, workingHours, isDayOff } = req.body;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere una fecha.'
            });
        }

        const override = await prisma.barberScheduleOverride.upsert({
            where: {
                barberId_date: {
                    barberId: id,
                    date: new Date(date)
                }
            },
            update: {
                workingHours: typeof workingHours === 'string'
                    ? workingHours
                    : JSON.stringify(workingHours || []),
                isDayOff: isDayOff || false
            },
            create: {
                barberId: id,
                date: new Date(date),
                workingHours: typeof workingHours === 'string'
                    ? workingHours
                    : JSON.stringify(workingHours || []),
                isDayOff: isDayOff || false
            }
        });

        res.status(200).json({
            success: true,
            message: 'Excepción de horario creada.',
            override
        });
    } catch (error) {
        console.error('Error al crear excepción de horario:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al crear excepción.'
        });
    }
}

/**
 * Delete schedule override for a barber
 */
export async function deleteBarberOverride(req, res) {
    try {
        const { id, overrideId } = req.params;

        await prisma.barberScheduleOverride.delete({
            where: { id: overrideId }
        });

        res.status(200).json({
            success: true,
            message: 'Excepción de horario eliminada.'
        });
    } catch (error) {
        console.error('Error al eliminar excepción de horario:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al eliminar excepción.'
        });
    }
}

export default {
    getAllBarbers,
    getAllBarbersAdmin,
    getBarberById,
    createBarber,
    updateBarber,
    deleteBarber,
    updateBarberSchedule,
    getAvailableBarbersForDate,
    createBarberOverride,
    deleteBarberOverride
};
