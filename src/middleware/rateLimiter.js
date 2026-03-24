// --- src/middleware/rateLimiter.js ---
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

/**
 * General rate limiter for all routes
 * 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Demasiadas solicitudes. Por favor, espera unos minutos.',
        retryAfter: 15
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

/**
 * Strict rate limiter for authentication routes
 * 5 attempts per 15 minutes per IP
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: {
        success: false,
        message: 'Demasiados intentos de inicio de sesión. Por favor, espera 15 minutos.',
        retryAfter: 15
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

/**
 * Rate limiter for booking/appointment routes
 * 3 requests per minute per IP (prevents duplicate bookings)
 */
export const bookingLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3, // Limit each IP to 3 booking requests per minute
    message: {
        success: false,
        message: 'Por favor, espera un momento antes de realizar otra reserva.',
        retryAfter: 1
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

/**
 * Rate limiter for upload routes
 * 10 uploads per 10 minutes per IP
 */
export const uploadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // Limit each IP to 10 uploads per windowMs
    message: {
        success: false,
        message: 'Demasiadas subidas de archivos. Por favor, espera unos minutos.',
        retryAfter: 10
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

/**
 * Speed limiter - gradually slows down responses for repeated requests
 * Useful for preventing brute force without completely blocking
 */
export const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Allow 50 requests per 15 minutes without delay
    delayMs: (hits) => hits * 100, // Add 100ms delay per request above limit
    maxDelayMs: 5000, // Maximum delay of 5 seconds
});

/**
 * Create a custom rate limiter
 * @param {Object} options - Rate limiter options
 * @returns {Function} Express middleware
 */
export function createRateLimiter({ windowMs, max, message }) {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            message,
            retryAfter: Math.ceil(windowMs / 60000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res, next, options) => {
            res.status(429).json(options.message);
        }
    });
}

export default {
    generalLimiter,
    authLimiter,
    bookingLimiter,
    uploadLimiter,
    speedLimiter,
    createRateLimiter
};
