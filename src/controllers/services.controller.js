// --- src/controllers/services.controller.js ---
import { prisma } from '../config/database.js';

/**
 * Get all services
 */
export async function getAllServices(req, res) {
    try {
        const services = await prisma.service.findMany({
            orderBy: { name: 'asc' }
        });

        res.status(200).json({
            success: true,
            services
        });
    } catch (error) {
        console.error('Error al obtener servicios:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener servicios.'
        });
    }
}

/**
 * Create a new service
 */
export async function createService(req, res) {
    try {
        const { name, description, price, duration } = req.body;

        if (!name || !description || price === undefined || duration === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos.'
            });
        }

        const parsedPrice = parseFloat(price);
        const parsedDuration = parseInt(duration, 10);

        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({
                success: false,
                message: 'El precio debe ser un número válido mayor o igual a 0.'
            });
        }

        if (isNaN(parsedDuration) || parsedDuration <= 0) {
            return res.status(400).json({
                success: false,
                message: 'La duración debe ser un número entero positivo.'
            });
        }

        const newService = await prisma.service.create({
            data: {
                name,
                description,
                price: parsedPrice,
                duration: parsedDuration
            }
        });

        res.status(201).json({
            success: true,
            message: 'Servicio añadido.',
            service: newService
        });
    } catch (error) {
        console.error('Error al crear servicio:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al crear servicio.'
        });
    }
}

/**
 * Update a service
 */
export async function updateService(req, res) {
    try {
        const { id } = req.params;
        const { name, description, price, duration } = req.body;

        if (!name || !description || price === undefined || duration === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos.'
            });
        }

        const parsedPrice = parseFloat(price);
        const parsedDuration = parseInt(duration, 10);

        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({
                success: false,
                message: 'El precio debe ser un número válido mayor o igual a 0.'
            });
        }

        if (isNaN(parsedDuration) || parsedDuration <= 0) {
            return res.status(400).json({
                success: false,
                message: 'La duración debe ser un número entero positivo.'
            });
        }

        const updatedService = await prisma.service.update({
            where: { id },
            data: {
                name,
                description,
                price: parsedPrice,
                duration: parsedDuration
            }
        });

        res.status(200).json({
            success: true,
            message: 'Servicio actualizado.',
            service: updatedService
        });
    } catch (error) {
        console.error('Error al actualizar servicio:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar servicio.'
        });
    }
}

/**
 * Delete a service
 */
export async function deleteService(req, res) {
    try {
        const { id } = req.params;

        // Check if service has appointments
        const appointmentCount = await prisma.appointment.count({
            where: { serviceId: id }
        });

        if (appointmentCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar un servicio con citas asociadas.'
            });
        }

        await prisma.service.delete({ where: { id } });

        res.status(200).json({
            success: true,
            message: 'Servicio eliminado.'
        });
    } catch (error) {
        console.error('Error al eliminar servicio:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al eliminar servicio.'
        });
    }
}

export default {
    getAllServices,
    createService,
    updateService,
    deleteService
};
