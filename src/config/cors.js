// --- src/config/cors.js ---

/**
 * CORS configuration for production deployment
 * Whitelist of allowed origins from environment variable
 */

const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
const isDevelopment = process.env.NODE_ENV !== 'production';

// Parse allowed origins from environment variable (comma-separated)
const allowedOrigins = allowedOriginsEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

// In development, allow localhost origins
if (isDevelopment) {
    allowedOrigins.push(
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5500',
        'http://localhost:8080'
    );
}

/**
 * CORS options configuration
 *
 * DISPARADORES EN TERMINAL:
 * - "CORS: Origin X not in allowed list, but allowing in dev mode" -> Origen no permitido pero aceptado en desarrollo
 * - "CORS blocked: X" -> Origen bloqueado en producción
 */
export const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, curl, etc.)
        if (!origin) {
            return callback(null, true);
        }

        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else if (isDevelopment) {
            // DISPARADOR: Avisa que un origen no está en la lista pero se permite en desarrollo
            console.warn(`CORS: Origin ${origin} not in allowed list, but allowing in dev mode`);
            callback(null, true);
        } else {
            // DISPARADOR: Indica que un origen fue bloqueado en producción
            console.warn(`CORS blocked: ${origin}`);
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true, // Allow cookies and authorization headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-Token',
        'Accept',
        'Origin'
    ],
    exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
    ],
    maxAge: 86400, // 24 hours - browsers cache preflight response
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

/**
 * Get the list of allowed origins
 * @returns {string[]} Array of allowed origins
 */
export function getAllowedOrigins() {
    return [...allowedOrigins];
}

/**
 * Add an origin to the allowed list at runtime
 * @param {string} origin - Origin to add
 */
export function addAllowedOrigin(origin) {
    if (!allowedOrigins.includes(origin)) {
        allowedOrigins.push(origin);
    }
}

export default corsOptions;
