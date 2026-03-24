// --- config.js (Frontend Configuration) ---

// Dynamic API URL based on environment
const isDevelopment = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

export const API_BASE_URL = isDevelopment
    ? 'http://localhost:3000'
    : window.location.origin; // Use same origin in production

export const CONSTANTS = {
    ROLES: {
        ADMIN: 'ADMIN',
        CLIENT: 'CLIENT'
    },
    APPOINTMENT_STATUS: {
        CONFIRMED: 'CONFIRMED',
        CANCELLED: 'CANCELLED'
    },
    TOKEN_REFRESH_INTERVAL: 14 * 60 * 1000, // 14 minutes (before 15min expiry)
    SESSION_TIMEOUT: 30 * 60 * 1000 // 30 minutes of inactivity
};

// Storage keys
export const STORAGE_KEYS = {
    ACCESS_TOKEN: 'barber_accessToken',
    REFRESH_TOKEN: 'barber_refreshToken',
    USER: 'barber_currentUser',
    LAST_ACTIVITY: 'barber_lastActivity'
};

// Mensajes de error categorizados
export const ERROR_MESSAGES = {
    NETWORK: 'Sin conexión a internet. Verifica tu red e intenta de nuevo.',
    TIMEOUT: 'La solicitud tardó demasiado. Intenta de nuevo.',
    SERVER: 'Error del servidor. Intenta más tarde.',
    AUTH: 'Tu sesión expiró. Por favor, inicia sesión nuevamente.',
    VALIDATION: 'Por favor, revisa los datos ingresados.',
    UNKNOWN: 'Ocurrió un error inesperado. Intenta de nuevo.'
};

/**
 * Fetch con reintento automático y timeout
 * @param {string} url - URL a consultar
 * @param {Object} options - Opciones de fetch
 * @param {number} [retries=2] - Número de reintentos
 * @param {number} [timeout=8000] - Timeout en ms
 */
export async function fetchWithRetry(url, options = {}, retries = 2, timeout = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);

            // Si es el último intento, lanzar el error
            if (attempt === retries) {
                if (error.name === 'AbortError') {
                    throw { type: 'TIMEOUT', message: ERROR_MESSAGES.TIMEOUT };
                }
                if (!navigator.onLine) {
                    throw { type: 'NETWORK', message: ERROR_MESSAGES.NETWORK };
                }
                throw { type: 'UNKNOWN', message: ERROR_MESSAGES.UNKNOWN, original: error };
            }

            // Esperar antes de reintentar (backoff exponencial)
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
        }
    }
}

/**
 * Procesa errores de respuesta HTTP
 * @param {Response} response - Respuesta de fetch
 * @returns {Object} Error categorizado
 */
export async function handleResponseError(response) {
    let message = ERROR_MESSAGES.SERVER;
    let type = 'SERVER';

    try {
        const data = await response.json();
        message = data.message || message;

        switch (response.status) {
            case 400:
                type = 'VALIDATION';
                message = data.message || ERROR_MESSAGES.VALIDATION;
                break;
            case 401:
                type = 'AUTH';
                message = ERROR_MESSAGES.AUTH;
                break;
            case 404:
                type = 'NOT_FOUND';
                message = data.message || 'El recurso solicitado no existe.';
                break;
            case 409:
                type = 'CONFLICT';
                message = data.message || 'Este horario ya no está disponible. Por favor, selecciona otro.';
                break;
            case 429:
                type = 'RATE_LIMIT';
                message = data.message || 'Demasiadas solicitudes. Espera un momento.';
                break;
            case 500:
            case 502:
            case 503:
            case 504:
                type = 'SERVER';
                message = ERROR_MESSAGES.SERVER;
                break;
            default:
                type = 'UNKNOWN';
                message = data.message || ERROR_MESSAGES.UNKNOWN;
        }
    } catch {
        // Si no puede parsear JSON, usar mensaje genérico basado en status
        if (response.status >= 500) {
            message = ERROR_MESSAGES.SERVER;
        } else if (response.status === 404) {
            message = 'El recurso solicitado no existe.';
            type = 'NOT_FOUND';
        }
    }

    return { type, message, status: response.status };
}
