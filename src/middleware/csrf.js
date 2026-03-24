// --- src/middleware/csrf.js ---
import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Store for CSRF tokens (in production, use Redis or database)
const csrfTokens = new Map();

// Clean up expired tokens every hour
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of csrfTokens.entries()) {
        if (now > data.expiresAt) {
            csrfTokens.delete(token);
        }
    }
}, 60 * 60 * 1000);

/**
 * Generate a CSRF token
 * @returns {string} CSRF token
 */
function generateCsrfToken() {
    return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Middleware to generate and set CSRF token
 * Sets token in cookie and makes it available in request
 */
export function csrfProtection(req, res, next) {
    // Skip CSRF for GET, HEAD, OPTIONS requests (safe methods)
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

    if (safeMethods.includes(req.method)) {
        // Generate token for subsequent POST/PUT/DELETE requests
        let token = req.cookies?.[CSRF_COOKIE_NAME];

        if (!token || !csrfTokens.has(token)) {
            token = generateCsrfToken();
            csrfTokens.set(token, {
                createdAt: Date.now(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            });

            // Set cookie with security options
            res.cookie(CSRF_COOKIE_NAME, token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
        }

        // Make token available in response for frontend to read
        req.csrfToken = () => token;
        res.locals.csrfToken = token;

        return next();
    }

    // For unsafe methods, validate the token
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];

    if (!cookieToken || !headerToken) {
        return res.status(403).json({
            success: false,
            message: 'Token CSRF faltante.'
        });
    }

    if (cookieToken !== headerToken) {
        return res.status(403).json({
            success: false,
            message: 'Token CSRF inválido.'
        });
    }

    if (!csrfTokens.has(cookieToken)) {
        return res.status(403).json({
            success: false,
            message: 'Token CSRF expirado.'
        });
    }

    next();
}

/**
 * Route to get CSRF token
 * Frontend should call this to get the token before making POST/PUT/DELETE requests
 */
export function getCsrfToken(req, res) {
    let token = req.cookies?.[CSRF_COOKIE_NAME];

    if (!token || !csrfTokens.has(token)) {
        token = generateCsrfToken();
        csrfTokens.set(token, {
            createdAt: Date.now(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000)
        });

        res.cookie(CSRF_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });
    }

    res.json({ csrfToken: token });
}

/**
 * Middleware that skips CSRF check for API routes with JWT auth
 * JWT tokens already provide protection against CSRF
 */
export function csrfProtectionWithJwtBypass(req, res, next) {
    // If request has a valid Authorization header, skip CSRF
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return next();
    }

    // Otherwise, apply CSRF protection
    return csrfProtection(req, res, next);
}

export default {
    csrfProtection,
    getCsrfToken,
    csrfProtectionWithJwtBypass
};
