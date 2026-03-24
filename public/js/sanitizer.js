// --- js/sanitizer.js (Frontend XSS Prevention) ---

/**
 * Escape HTML entities to prevent XSS
 * Use this for displaying user-generated text content
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return str;

    const htmlEntities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    return str.replace(/[&<>"'`=\/]/g, char => htmlEntities[char]);
}

/**
 * Sanitize HTML content using DOMPurify
 * Use this for content that should allow some HTML (like admin CMS content)
 * @param {string} html - HTML string to sanitize
 * @param {Object} options - DOMPurify options
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(html, options = {}) {
    if (typeof html !== 'string') return html;

    // Check if DOMPurify is available
    if (typeof DOMPurify !== 'undefined') {
        const defaultOptions = {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
            ALLOW_DATA_ATTR: false,
            ADD_ATTR: ['target'], // Force target="_blank" on links
            FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
        };

        return DOMPurify.sanitize(html, { ...defaultOptions, ...options });
    }

    // Fallback: escape everything if DOMPurify not available
    console.warn('DOMPurify not loaded, falling back to escapeHtml');
    return escapeHtml(html);
}

/**
 * Sanitize a URL to prevent javascript: and data: protocols
 * @param {string} url - URL to sanitize
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function sanitizeUrl(url) {
    if (typeof url !== 'string') return null;

    const trimmed = url.trim().toLowerCase();

    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    for (const protocol of dangerousProtocols) {
        if (trimmed.startsWith(protocol)) {
            console.warn('Blocked dangerous URL:', url);
            return null;
        }
    }

    // Allow http, https, mailto, tel, and relative URLs
    if (trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('mailto:') ||
        trimmed.startsWith('tel:') ||
        trimmed.startsWith('/') ||
        trimmed.startsWith('#') ||
        !trimmed.includes(':')) {
        return url;
    }

    return null;
}

/**
 * Create a text node (always safe from XSS)
 * @param {string} text - Text content
 * @returns {Text} Text node
 */
export function createTextNode(text) {
    return document.createTextNode(text);
}

/**
 * Safely set text content of an element
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text to set
 */
export function setTextContent(element, text) {
    if (element) {
        element.textContent = text;
    }
}

/**
 * Safely set innerHTML with sanitization
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML to set (will be sanitized)
 */
export function setSafeHtml(element, html) {
    if (element) {
        element.innerHTML = sanitizeHtml(html);
    }
}

/**
 * Safely set innerHTML for trusted CMS content
 * Only use this for content from admin that's already sanitized server-side
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML to set
 */
export function setTrustedHtml(element, html) {
    if (element) {
        // Still sanitize even "trusted" content as defense in depth
        element.innerHTML = sanitizeHtml(html, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
        });
    }
}

/**
 * Sanitize an object's string properties
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
export function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            result[key] = escapeHtml(value);
        } else if (Array.isArray(value)) {
            result[key] = value.map(item =>
                typeof item === 'string' ? escapeHtml(item) : sanitizeObject(item)
            );
        } else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeObject(value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Validate and sanitize email format
 * @param {string} email - Email to validate
 * @returns {string|null} Sanitized email or null if invalid
 */
export function sanitizeEmail(email) {
    if (typeof email !== 'string') return null;

    const sanitized = escapeHtml(email.trim().toLowerCase());
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailRegex.test(sanitized) ? sanitized : null;
}

// Export default object for convenience
export default {
    escapeHtml,
    sanitizeHtml,
    sanitizeUrl,
    createTextNode,
    setTextContent,
    setSafeHtml,
    setTrustedHtml,
    sanitizeObject,
    sanitizeEmail
};
