// --- src/controllers/schedule.controller.js ---
import { prisma } from '../config/database.js';

/**
 * Get weekly schedule
 */
export async function getSchedule(req, res) {
    try {
        const schedule = await prisma.workSchedule.findMany({
            orderBy: { dayOfWeek: 'asc' }
        });

        res.status(200).json(schedule);
    } catch (error) {
        console.error('Error al obtener horario:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener horario.'
        });
    }
}

/**
 * Update weekly schedule
 */
export async function updateSchedule(req, res) {
    try {
        const newSchedule = req.body;

        if (!Array.isArray(newSchedule)) {
            return res.status(400).json({
                success: false,
                message: 'El horario debe ser un array.'
            });
        }

        const updateTransactions = newSchedule.map(day =>
            prisma.workSchedule.update({
                where: { dayOfWeek: day.dayOfWeek },
                data: {
                    workingHours: day.workingHours,
                    isDayOff: day.isDayOff
                }
            })
        );

        await prisma.$transaction(updateTransactions);

        res.status(200).json({
            success: true,
            message: 'Horario semanal actualizado con éxito.'
        });
    } catch (error) {
        console.error('Error al actualizar horario:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar horario.'
        });
    }
}

/**
 * Get schedule overrides
 */
export async function getOverrides(req, res) {
    try {
        const overrides = await prisma.scheduleOverride.findMany({
            orderBy: { date: 'asc' }
        });

        res.json(overrides);
    } catch (error) {
        console.error('Error al obtener excepciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener excepciones de horario.'
        });
    }
}

/**
 * Create or update schedule override
 */
export async function createOverride(req, res) {
    try {
        const { date, workingHours, isDayOff } = req.body;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'La fecha es requerida.'
            });
        }

        const targetDate = new Date(date);

        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'El formato de fecha no es válido.'
            });
        }

        const updatedOrCreated = await prisma.scheduleOverride.upsert({
            where: { date: targetDate },
            update: { workingHours, isDayOff },
            create: { date: targetDate, workingHours, isDayOff }
        });

        res.status(201).json({
            success: true,
            message: 'Horario especial guardado.',
            override: updatedOrCreated
        });
    } catch (error) {
        console.error('Error al crear excepción:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al guardar horario especial.'
        });
    }
}

/**
 * Delete schedule override
 */
export async function deleteOverride(req, res) {
    try {
        const { date } = req.params;

        const targetDate = new Date(date);
        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'El formato de fecha no es válido.'
            });
        }

        await prisma.scheduleOverride.delete({
            where: { date: targetDate }
        });

        res.status(200).json({
            success: true,
            message: 'Horario especial eliminado. Se usará el horario semanal.'
        });
    } catch (error) {
        console.error('Error al eliminar excepción:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al eliminar horario especial.'
        });
    }
}

export default {
    getSchedule,
    updateSchedule,
    getOverrides,
    createOverride,
    deleteOverride
};
