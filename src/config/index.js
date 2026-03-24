// --- src/config/index.js ---

export const config = {
    // Server
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',

    // JWT
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTokenExpiry: '15m',
    refreshTokenExpiryDays: 7,

    // Database
    databaseUrl: process.env.DATABASE_URL,

    // Email (SendGrid)
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    adminEmail: process.env.ADMIN_EMAIL || 'admin@barberia.com',
    senderEmail: process.env.SENDER_EMAIL || 'noreply@barberia.com',

    // Cloudinary
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    },

    // Security
    bcryptSaltRounds: 10,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes

    // Rate limiting
    rateLimits: {
        general: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100
        },
        auth: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5
        },
        booking: {
            windowMs: 60 * 1000, // 1 minute
            max: 3
        }
    }
};

/**
 * Validate required environment variables
 * @throws {Error} If required variables are missing
 *
 * DISPARADORES EN TERMINAL:
 * - "⚠️ Warning: Missing environment variables: X" -> Faltan variables de entorno
 * - "Using default values. DO NOT use in production!" -> Se usan valores por defecto
 */
export function validateEnv() {
    const required = [
        'JWT_SECRET',
        'JWT_REFRESH_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0 && config.isProduction) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (missing.length > 0) {
        // DISPARADOR: Advierte sobre variables de entorno faltantes
        console.warn(`⚠️  Warning: Missing environment variables: ${missing.join(', ')}`);
        // DISPARADOR: Indica que se usan valores por defecto (no seguro en producción)
        console.warn('   Using default values. DO NOT use in production!');
    }
}

export default config;
