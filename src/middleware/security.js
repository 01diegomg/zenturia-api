// --- src/middleware/security.js ---
import helmet from 'helmet';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Content Security Policy configuration
 * Restricts which resources can be loaded
 */
const contentSecurityPolicy = {
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for inline scripts (consider removing in strict mode)
            "https://cdn.jsdelivr.net", // DOMPurify CDN
            "https://cdnjs.cloudflare.com"
        ],
        styleSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Tailwind and inline styles
            "https://fonts.googleapis.com"
        ],
        fontSrc: [
            "'self'",
            "https://fonts.gstatic.com"
        ],
        imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https://res.cloudinary.com", // Cloudinary images
            "https://images.unsplash.com", // Unsplash images
            "https://*.googleusercontent.com" // Google Maps
        ],
        connectSrc: [
            "'self'",
            isDevelopment ? "http://localhost:*" : "",
            isDevelopment ? "ws://localhost:*" : "" // WebSocket for live-server
        ].filter(Boolean),
        frameSrc: [
            "'self'",
            "https://www.google.com", // Google Maps embed
            "https://maps.google.com"
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        childSrc: ["'self'", "blob:"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: isDevelopment ? null : []
    }
};

/**
 * Helmet middleware configuration with security headers
 */
export const securityHeaders = helmet({
    contentSecurityPolicy: isDevelopment ? false : contentSecurityPolicy,
    crossOriginEmbedderPolicy: false, // Required for external images
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'sameorigin' },
    hidePoweredBy: true,
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
});

/**
 * Additional security headers middleware
 */
export function additionalSecurityHeaders(req, res, next) {
    // Prevent caching of sensitive data
    if (req.path.includes('/login') || req.path.includes('/register') || req.path.includes('/appointments')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }

    // Additional headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Permissions Policy (formerly Feature Policy)
    res.setHeader('Permissions-Policy',
        'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    );

    next();
}

/**
 * Middleware to prevent clickjacking
 */
export function preventClickjacking(req, res, next) {
    res.setHeader('X-Frame-Options', 'DENY');
    next();
}

export default {
    securityHeaders,
    additionalSecurityHeaders,
    preventClickjacking
};
