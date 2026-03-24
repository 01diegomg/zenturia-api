// --- src/middleware/sanitize.js ---
import sanitizeHtml from 'sanitize-html';

/**
 * Strict sanitization options - removes all HTML
 * Use for user input like names, emails, etc.
 */
const strictOptions = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
};

/**
 * CMS sanitization options - allows basic HTML for admin content
 * Use for content that admins can edit (about section, descriptions, etc.)
 */
const cmsOptions = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'ul', 'ol', 'li',
        'strong', 'b', 'em', 'i', 'u', 's',
        'a', 'span', 'div',
        'blockquote', 'pre', 'code'
    ],
    allowedAttributes: {
        'a': ['href', 'target', 'rel'],
        'span': ['class'],
        'div': ['class'],
        'p': ['class'],
        '*': ['class'] // Allow class on all elements
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
        a: ['http', 'https', 'mailto']
    },
    transformTags: {
        'a': function(tagName, attribs) {
            // Add security attributes to links
            return {
                tagName: 'a',
                attribs: {
                    ...attribs,
                    target: '_blank',
                    rel: 'noopener noreferrer'
                }
            };
        }
    }
};

/**
 * Sanitize a string with strict options (no HTML allowed)
 * @param {string} input - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeStrict(input) {
    if (typeof input !== 'string') return input;
    return sanitizeHtml(input, strictOptions).trim();
}

/**
 * Sanitize a string with CMS options (basic HTML allowed)
 * @param {string} input - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeCms(input) {
    if (typeof input !== 'string') return input;
    return sanitizeHtml(input, cmsOptions);
}

/**
 * Escape HTML entities (for displaying user input as text)
 * @param {string} input - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(input) {
    if (typeof input !== 'string') return input;
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Sanitize an object recursively
 * @param {Object} obj - Object to sanitize
 * @param {Object} options - Sanitization options per field
 * @returns {Object} Sanitized object
 */
export function sanitizeObject(obj, options = {}) {
    if (!obj || typeof obj !== 'object') return obj;

    const result = {};

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            // Check if this field should use CMS sanitization
            if (options.cmsFields && options.cmsFields.includes(key)) {
                result[key] = sanitizeCms(value);
            } else if (options.skipFields && options.skipFields.includes(key)) {
                // Skip sanitization for certain fields (like passwords)
                result[key] = value;
            } else {
                result[key] = sanitizeStrict(value);
            }
        } else if (Array.isArray(value)) {
            result[key] = value.map(item =>
                typeof item === 'object' ? sanitizeObject(item, options) :
                typeof item === 'string' ? sanitizeStrict(item) : item
            );
        } else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeObject(value, options);
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Middleware for strict input sanitization
 * Sanitizes all string fields in req.body
 */
export function sanitizeInput(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, {
            skipFields: ['password', 'currentPassword', 'newPassword']
        });
    }

    if (req.params) {
        for (const key in req.params) {
            if (typeof req.params[key] === 'string') {
                req.params[key] = sanitizeStrict(req.params[key]);
            }
        }
    }

    if (req.query) {
        for (const key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeStrict(req.query[key]);
            }
        }
    }

    next();
}

/**
 * Middleware for CMS content sanitization
 * Allows basic HTML in specified fields
 */
export function sanitizeCmsInput(cmsFields = []) {
    return (req, res, next) => {
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeObject(req.body, {
                cmsFields,
                skipFields: ['password']
            });
        }
        next();
    };
}

/**
 * Validate and sanitize email
 * @param {string} email - Email to validate
 * @returns {string|null} Sanitized email or null if invalid
 */
export function sanitizeEmail(email) {
    if (typeof email !== 'string') return null;

    const sanitized = sanitizeStrict(email).toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(sanitized)) return null;

    return sanitized;
}

/**
 * Validate and sanitize URL
 * @param {string} url - URL to validate
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function sanitizeUrl(url) {
    if (typeof url !== 'string') return null;

    try {
        const parsed = new URL(url);

        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return null;
        }

        return parsed.href;
    } catch {
        return null;
    }
}

export default {
    sanitizeStrict,
    sanitizeCms,
    escapeHtml,
    sanitizeObject,
    sanitizeInput,
    sanitizeCmsInput,
    sanitizeEmail,
    sanitizeUrl
};
