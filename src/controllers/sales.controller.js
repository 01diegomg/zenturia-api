// --- src/controllers/sales.controller.js ---
import * as salesService from '../services/sales.service.js';

/**
 * Obtiene las estadísticas de ventas
 *
 * Query parameters:
 * - period: 'today', 'week', 'month', 'year', 'custom' (default: 'today')
 * - startDate: Fecha de inicio (solo si period === 'custom')
 * - endDate: Fecha de fin (solo si period === 'custom')
 */
export async function getSalesStats(req, res) {
    try {
        const { period = 'today', startDate, endDate } = req.query;

        // Validar período
        const validPeriods = ['today', 'week', 'month', 'year', 'custom'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Período inválido. Usa: today, week, month, year, o custom.'
            });
        }

        // Si es custom, validar fechas
        if (period === 'custom') {
            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Para período custom, se requieren startDate y endDate.'
                });
            }
        }

        const stats = await salesService.getSalesStats(period, startDate, endDate);

        res.status(200).json({
            success: true,
            ...stats
        });
    } catch (error) {
        console.error('Error en GET /sales/stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las estadísticas de ventas.'
        });
    }
}

/**
 * Obtiene un resumen rápido del día actual
 */
export async function getDailySummary(req, res) {
    try {
        const summary = await salesService.getDailySummary();
        res.status(200).json({
            success: true,
            ...summary
        });
    } catch (error) {
        console.error('Error en GET /sales/daily:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el resumen diario.'
        });
    }
}

export default {
    getSalesStats,
    getDailySummary
};
