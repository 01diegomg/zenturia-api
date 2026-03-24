// --- src/middleware/auth.js ---
import { verifyAccessToken } from '../services/auth.service.js';
import { prisma } from '../config/database.js';

// Session timeout in milliseconds (30 minutes of inactivity)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Store last activity timestamps
// ⚠️ ADVERTENCIA: Este Map está en memoria y NO funciona con múltiples instancias del servidor.
// Para producción con múltiples instancias (PM2 cluster, Docker, etc.), usar Redis:
// - npm install redis
// - Reemplazar userActivity Map por Redis client
const userActivity = new Map();

// Limpieza automática de sesiones expiradas cada 5 minutos (evita memory leaks)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [userId, lastActivity] of userActivity.entries()) {
        if ((now - lastActivity) > SESSION_TIMEOUT) {
            userActivity.delete(userId);
        }
    }
}, CLEANUP_INTERVAL);

/**
 * Middleware to authenticate JWT tokens
 * Extracts token from Authorization header (Bearer token)
 */
export async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Acceso denegado. Token no proporcionado.'
        });
    }

    const decoded = verifyAccessToken(token);

    if (!decoded) {
        return res.status(401).json({
            success: false,
            message: 'Token inválido o expirado.',
            code: 'TOKEN_EXPIRED'
        });
    }

    try {
        // Check token version (for forced logout)
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { tokenVersion: true }
        });

        if (!user || user.tokenVersion !== decoded.tokenVersion) {
            return res.status(401).json({
                success: false,
                message: 'Sesión inválida. Por favor, inicia sesión de nuevo.',
                code: 'TOKEN_REVOKED'
            });
        }

        // Attach user info to request
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Error verifying token version:', error);
        return res.status(500).json({
            success: false,
            message: 'Error del servidor.'
        });
    }
}

/**
 * Middleware to require admin role
 * Must be used after authenticateToken
 */
export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Autenticación requerida.'
        });
    }

    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Se requieren permisos de administrador.'
        });
    }

    next();
}

/**
 * Middleware to check session timeout (inactivity)
 * Must be used after authenticateToken
 */
export function checkSessionTimeout(req, res, next) {
    if (!req.user) {
        return next();
    }

    const userId = req.user.userId;
    const now = Date.now();
    const lastActivity = userActivity.get(userId);

    if (lastActivity && (now - lastActivity) > SESSION_TIMEOUT) {
        userActivity.delete(userId);
        return res.status(401).json({
            success: false,
            message: 'Sesión expirada por inactividad.',
            code: 'SESSION_TIMEOUT'
        });
    }

    // Update last activity
    userActivity.set(userId, now);
    next();
}

/**
 * Optional authentication - doesn't fail if no token
 * Useful for routes that work differently for authenticated users
 */
export function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    const decoded = verifyAccessToken(token);

    if (decoded) {
        req.user = decoded;
    }

    next();
}

/**
 * Middleware to require the user to be the owner of a resource or an admin
 * @param {Function} getResourceUserId - Function that extracts user ID from request
 */
export function requireOwnerOrAdmin(getResourceUserId) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida.'
            });
        }

        // Admins can access anything
        if (req.user.role === 'ADMIN') {
            return next();
        }

        try {
            const resourceUserId = await getResourceUserId(req);

            if (resourceUserId !== req.user.userId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para acceder a este recurso.'
                });
            }

            next();
        } catch (error) {
            console.error('Error checking resource ownership:', error);
            return res.status(500).json({
                success: false,
                message: 'Error del servidor.'
            });
        }
    };
}

export default {
    authenticateToken,
    requireAdmin,
    checkSessionTimeout,
    optionalAuth,
    requireOwnerOrAdmin
};
