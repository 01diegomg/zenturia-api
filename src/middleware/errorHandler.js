// --- src/middleware/errorHandler.js ---

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
    constructor(statusCode, message, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Not found error handler (404)
 */
export function notFoundHandler(req, res, next) {
    res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
}

/**
 * Global error handler middleware
 * Must be the last middleware in the chain
 */
export function errorHandler(err, req, res, next) {
    // Log error in development
    if (process.env.NODE_ENV !== 'production') {
        console.error('Error:', err);
    }

    // Handle Prisma errors
    if (err.code && err.code.startsWith('P')) {
        return handlePrismaError(err, res);
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Token inválido.',
            code: 'INVALID_TOKEN'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expirado.',
            code: 'TOKEN_EXPIRED'
        });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Datos de entrada inválidos.',
            errors: err.errors
        });
    }

    // Handle multer errors (file upload)
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'El archivo es demasiado grande.'
        });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            success: false,
            message: 'Tipo de archivo no permitido.'
        });
    }

    // Handle custom API errors
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code: err.code
        });
    }

    // Handle CORS errors
    if (err.message === 'No permitido por CORS') {
        return res.status(403).json({
            success: false,
            message: 'Origen no permitido.'
        });
    }

    // Default error response
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor.'
        : err.message;

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
}

/**
 * Handle Prisma database errors
 */
function handlePrismaError(err, res) {
    switch (err.code) {
        case 'P2002':
            // Unique constraint violation
            return res.status(409).json({
                success: false,
                message: 'Este registro ya existe.',
                code: 'DUPLICATE_ENTRY'
            });

        case 'P2025':
            // Record not found
            return res.status(404).json({
                success: false,
                message: 'Registro no encontrado.',
                code: 'NOT_FOUND'
            });

        case 'P2003':
            // Foreign key constraint failed
            return res.status(400).json({
                success: false,
                message: 'Referencia inválida.',
                code: 'INVALID_REFERENCE'
            });

        case 'P2014':
            // Required relation violation
            return res.status(400).json({
                success: false,
                message: 'Relación requerida no proporcionada.',
                code: 'REQUIRED_RELATION'
            });

        default:
            console.error('Prisma error:', err);
            return res.status(500).json({
                success: false,
                message: 'Error de base de datos.',
                code: 'DATABASE_ERROR'
            });
    }
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

export default {
    ApiError,
    notFoundHandler,
    errorHandler,
    asyncHandler
};
