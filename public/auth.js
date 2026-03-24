// --- auth.js (JWT Authentication Handler) ---

import { API_BASE_URL, CONSTANTS, STORAGE_KEYS } from './config.js';
import * as ui from './ui.js';
import { state } from './main.js';
import * as admin from './admin.js';
import * as client from './client.js';

// In-memory token storage (more secure than sessionStorage for access token)
let accessToken = null;
let refreshTokenValue = null;
let tokenRefreshInterval = null;

// =======================================================
// VALIDATION UTILITIES
// =======================================================

const VALIDATION_RULES = {
    name: {
        minLength: 2,
        maxLength: 50,
        pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/,
        messages: {
            required: 'El nombre es requerido.',
            minLength: 'El nombre debe tener al menos 2 caracteres.',
            maxLength: 'El nombre no puede exceder 50 caracteres.',
            pattern: 'El nombre solo puede contener letras y espacios.',
            onlySpaces: 'El nombre no puede estar vacío o contener solo espacios.'
        }
    },
    email: {
        maxLength: 100,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        messages: {
            required: 'El correo electrónico es requerido.',
            maxLength: 'El correo no puede exceder 100 caracteres.',
            pattern: 'Ingresa un correo electrónico válido.'
        }
    },
    phone: {
        minLength: 10,
        maxLength: 15,
        pattern: /^[\d\s+()-]+$/,
        messages: {
            required: 'El teléfono es requerido.',
            minLength: 'El teléfono debe tener al menos 10 dígitos.',
            maxLength: 'El teléfono no puede exceder 15 caracteres.',
            pattern: 'El teléfono solo puede contener números, espacios y los símbolos +()-.'
        }
    }
};

/**
 * Validates a field value against rules
 * @param {string} fieldName - Name of the field (name, email, phone)
 * @param {string} value - Value to validate
 * @returns {Object} - { valid: boolean, message: string|null }
 */
function validateField(fieldName, value) {
    const rules = VALIDATION_RULES[fieldName];
    if (!rules) return { valid: true, message: null };

    const trimmedValue = value?.trim() || '';

    // Required check
    if (!trimmedValue) {
        return { valid: false, message: rules.messages.required };
    }

    // Check for only spaces (for name)
    if (fieldName === 'name' && trimmedValue !== value.replace(/\s+/g, ' ').trim()) {
        return { valid: false, message: rules.messages.onlySpaces };
    }

    // Min length check
    if (rules.minLength && trimmedValue.length < rules.minLength) {
        return { valid: false, message: rules.messages.minLength };
    }

    // Max length check
    if (rules.maxLength && trimmedValue.length > rules.maxLength) {
        return { valid: false, message: rules.messages.maxLength };
    }

    // Pattern check
    if (rules.pattern && !rules.pattern.test(trimmedValue)) {
        return { valid: false, message: rules.messages.pattern };
    }

    return { valid: true, message: null };
}

/**
 * Shows inline error message for a field
 * @param {HTMLElement} inputElement - The input element
 * @param {string} message - Error message to show
 */
function showFieldError(inputElement, message) {
    // Remove any existing error
    clearFieldError(inputElement);

    // Add error class to input
    inputElement.classList.add('input-error');

    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error-message';
    errorDiv.innerHTML = `<span class="material-icons">error</span><span>${message}</span>`;

    // Insert after input
    inputElement.parentNode.appendChild(errorDiv);
}

/**
 * Clears error state from a field
 * @param {HTMLElement} inputElement - The input element
 */
function clearFieldError(inputElement) {
    inputElement.classList.remove('input-error');
    const existingError = inputElement.parentNode.querySelector('.field-error-message');
    if (existingError) existingError.remove();
}

/**
 * Sets up real-time validation for an input
 * @param {HTMLElement} inputElement - The input element
 * @param {string} fieldName - Name of the field for validation rules
 */
export function setupFieldValidation(inputElement, fieldName) {
    if (!inputElement) return;

    const rules = VALIDATION_RULES[fieldName];
    if (!rules) return;

    // Add maxlength attribute
    if (rules.maxLength) {
        inputElement.setAttribute('maxlength', rules.maxLength);
    }

    // Add character counter for fields with max length
    if (rules.maxLength && rules.maxLength <= 100) {
        const counter = document.createElement('div');
        counter.className = 'char-counter';
        counter.textContent = `0/${rules.maxLength}`;
        inputElement.parentNode.appendChild(counter);

        inputElement.addEventListener('input', () => {
            const length = inputElement.value.length;
            counter.textContent = `${length}/${rules.maxLength}`;
            counter.classList.toggle('warning', length > rules.maxLength * 0.8);
            counter.classList.toggle('error', length >= rules.maxLength);
        });
    }

    // Validate on blur
    inputElement.addEventListener('blur', () => {
        const result = validateField(fieldName, inputElement.value);
        if (!result.valid) {
            showFieldError(inputElement, result.message);
        }
    });

    // Clear error on focus
    inputElement.addEventListener('focus', () => {
        clearFieldError(inputElement);
    });
}

/**
 * Initialize auth from storage on page load
 */
export function initAuth() {
    const storedUser = sessionStorage.getItem(STORAGE_KEYS.USER);
    refreshTokenValue = sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

    if (storedUser && refreshTokenValue) {
        state.currentUser = JSON.parse(storedUser);
        // Attempt to refresh token on load
        refreshAccessToken().catch(() => {
            // If refresh fails, logout
            handleLogout();
        });
        startTokenRefreshTimer();
        trackUserActivity();
    }
}

/**
 * Make an authenticated fetch request
 * Automatically adds Authorization header and handles token refresh
 */
export async function authFetch(url, options = {}) {
    // Ensure we have a valid token
    if (!accessToken && refreshTokenValue) {
        await refreshAccessToken();
    }

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    // Handle 401 - try to refresh token and retry
    if (response.status === 401) {
        const data = await response.json();

        if (data.code === 'TOKEN_EXPIRED' || data.code === 'TOKEN_REVOKED') {
            const refreshed = await refreshAccessToken();

            if (refreshed) {
                // Retry the request with new token
                headers['Authorization'] = `Bearer ${accessToken}`;
                return fetch(url, { ...options, headers });
            } else {
                // Refresh failed, logout
                handleLogout();
                throw new Error('Session expired');
            }
        }
    }

    return response;
}

/**
 * Refresh the access token using refresh token
 */
async function refreshAccessToken() {
    if (!refreshTokenValue) {
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: refreshTokenValue })
        });

        if (!response.ok) {
            throw new Error('Refresh failed');
        }

        const data = await response.json();

        accessToken = data.accessToken;
        refreshTokenValue = data.refreshToken;

        // Update stored tokens
        sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
        sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);

        // Update user info if provided
        if (data.user) {
            state.currentUser = { ...data.user, role: data.user.role };
            sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.currentUser));
        }

        return true;
    } catch (error) {
        console.error('Token refresh failed:', error);
        accessToken = null;
        return false;
    }
}

/**
 * Start automatic token refresh timer
 */
function startTokenRefreshTimer() {
    // Clear existing timer
    if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
    }

    // Refresh token every 14 minutes (before 15min expiry)
    tokenRefreshInterval = setInterval(async () => {
        if (refreshTokenValue) {
            await refreshAccessToken();
        }
    }, CONSTANTS.TOKEN_REFRESH_INTERVAL);
}

/**
 * Stop token refresh timer
 */
function stopTokenRefreshTimer() {
    if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
        tokenRefreshInterval = null;
    }
}

/**
 * Track user activity for session timeout
 */
function trackUserActivity() {
    const updateActivity = () => {
        sessionStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
    };

    // Update on user interaction
    ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
        document.addEventListener(event, updateActivity, { passive: true });
    });

    // Check for inactivity periodically
    setInterval(() => {
        const lastActivity = parseInt(sessionStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY) || '0');
        const now = Date.now();

        if (lastActivity && (now - lastActivity) > CONSTANTS.SESSION_TIMEOUT) {
            ui.showToast('Sesión expirada por inactividad.');
            handleLogout();
        }
    }, 60000); // Check every minute
}

/**
 * Store tokens after login
 */
function storeTokens(tokens) {
    accessToken = tokens.accessToken;
    refreshTokenValue = tokens.refreshToken;

    // Store both tokens in sessionStorage for compatibility
    sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
    sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
}

/**
 * Clear all tokens
 */
function clearTokens() {
    accessToken = null;
    refreshTokenValue = null;
    sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Handle client login
 * @returns {Promise<boolean>} True if login successful
 */
export async function handleClientLogin() {
    const email = ui.bookingModal.querySelector('#login-email').value;
    const password = ui.bookingModal.querySelector('#login-password').value;
    const btn = ui.clientLoginBtn;

    if (!email || !password) {
        ui.showToast("Por favor, ingresa tu correo y contraseña.", "warning");
        return false;
    }

    ui.setButtonLoadingState(btn, true, "Iniciando Sesión...");

    try {
        const response = await fetch(`${API_BASE_URL}/login/client`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (response.ok) {
            // Store tokens
            storeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });

            // Update state
            state.currentUser = { ...data.user, role: data.user.role };
            sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.currentUser));

            // Start token refresh
            startTokenRefreshTimer();
            trackUserActivity();

            ui.updateUIAfterLogin();
            ui.showToast(`Bienvenido de nuevo, ${state.currentUser.name}`, "success");
            return true;
        } else {
            ui.showToast(data.message, "error");
            return false;
        }
    } catch (error) {
        console.error("Error en handleClientLogin:", error);
        ui.showToast("Error de conexión con el servidor.", "error");
        return false;
    } finally {
        ui.setButtonLoadingState(btn, false, "Iniciar Sesión y Confirmar");
    }
}

/**
 * Handle client registration
 * @returns {Promise<boolean>} True if registration successful
 */
export async function handleClientRegister() {
    const nameInput = ui.bookingModal.querySelector('#register-name');
    const emailInput = ui.bookingModal.querySelector('#register-email');
    const passwordInput = ui.bookingModal.querySelector('#register-password');
    const btn = ui.clientRegisterBtn;

    const name = nameInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;

    // Clear previous errors
    clearFieldError(nameInput);
    clearFieldError(emailInput);
    clearFieldError(passwordInput);

    let hasErrors = false;

    // Validate name
    const nameValidation = validateField('name', name);
    if (!nameValidation.valid) {
        showFieldError(nameInput, nameValidation.message);
        hasErrors = true;
    }

    // Validate email
    const emailValidation = validateField('email', email);
    if (!emailValidation.valid) {
        showFieldError(emailInput, emailValidation.message);
        hasErrors = true;
    }

    // Validate password with requirements
    const { valid: passwordValid, requirements } = validatePassword(password, 'client');
    if (!passwordValid) {
        const unmet = requirements.filter(r => !r.met).map(r => r.text).join(', ');
        showFieldError(passwordInput, `Requisitos faltantes: ${unmet}`);
        hasErrors = true;
    }

    if (hasErrors) {
        ui.showToast("Por favor, corrige los errores en el formulario.", "warning");
        return false;
    }

    ui.setButtonLoadingState(btn, true, "Registrando...");

    try {
        const response = await fetch(`${API_BASE_URL}/register/client`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await response.json();

        if (response.ok) {
            // Store tokens
            storeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });

            // Update state
            state.currentUser = { ...data.user, role: data.user.role };
            sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.currentUser));

            // Start token refresh
            startTokenRefreshTimer();
            trackUserActivity();

            ui.updateUIAfterLogin();
            ui.showToast(`¡Cuenta creada! Bienvenido, ${name}`, "success");
            return true;
        } else {
            ui.showToast(data.message, "error");
            return false;
        }
    } catch (error) {
        console.error("Error en handleClientRegister:", error);
        ui.showToast("Error de conexión con el servidor.", "error");
        return false;
    } finally {
        ui.setButtonLoadingState(btn, false, "Registrarse y Confirmar");
    }
}

/**
 * Handle admin login
 * @param {string} user - Admin email
 * @param {string} pass - Admin password
 */
export async function handleAdminLogin(user, pass) {
    const btn = ui.adminLoginBtn;

    // Validación de campos vacíos
    if (!user || !pass) {
        ui.showToast("Por favor, ingresa usuario y contraseña.", "warning");
        return;
    }

    ui.setButtonLoadingState(btn, true, "Ingresando...");

    try {
        const response = await fetch(`${API_BASE_URL}/login/admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, pass }),
        });
        const data = await response.json();

        if (response.ok) {
            // Store tokens
            storeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });

            // Update state with admin role
            state.currentUser = { ...data.user, role: CONSTANTS.ROLES.ADMIN };
            sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.currentUser));

            // Start token refresh
            startTokenRefreshTimer();
            trackUserActivity();

            ui.closeAllModals();
            ui.updateUIAfterLogin();
            ui.showView('admin');

            // NUEVO: Verificar si el sitio necesita configuración inicial
            // El wizard SOLO aparece para el admin después de loguearse
            if (!state.siteContent?.isConfigured) {
                const wizardModal = document.getElementById('setup-wizard-modal');
                if (wizardModal) {
                    wizardModal.classList.remove('hidden');
                    ui.showToast('Configura tu negocio para comenzar.');
                }
            }

            await admin.renderAdminView();
        } else {
            ui.showToast(data.message, "error");
        }
    } catch (error) {
        console.error("Error de conexión en handleAdminLogin:", error);
        ui.showToast("No se pudo conectar al servidor. Inténtalo de nuevo.", "error");
    } finally {
        ui.setButtonLoadingState(btn, false, "Ingresar");
    }
}

/**
 * Handle logout
 */
export async function handleLogout() {
    try {
        // Notify server to invalidate refresh token
        if (refreshTokenValue) {
            await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: refreshTokenValue })
            });
        }
    } catch (error) {
        console.error("Error during logout:", error);
    }

    // Clear all tokens and state
    clearTokens();
    stopTokenRefreshTimer();

    state.currentUser = null;
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    sessionStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);

    ui.showToast("Has cerrado sesión.");

    // Reload to reset state
    window.location.reload();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
    return !!state.currentUser && !!refreshTokenValue;
}

/**
 * Check if user is admin
 */
export function isAdmin() {
    return state.currentUser?.role === CONSTANTS.ROLES.ADMIN;
}

/**
 * Get current access token (for manual API calls)
 */
export function getAccessToken() {
    return accessToken;
}

/**
 * Password requirements configuration
 */
const PASSWORD_REQUIREMENTS = {
    client: {
        minLength: 8,
        requireUppercase: false,
        requireLowercase: true,
        requireNumber: true,
        requireSpecial: false
    },
    admin: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecial: true
    }
};

/**
 * Validate password against requirements
 * @param {string} password - Password to validate
 * @param {string} userType - 'client' or 'admin'
 * @returns {Object} { valid: boolean, requirements: Array<{met: boolean, text: string}> }
 */
export function validatePassword(password, userType = 'client') {
    const config = PASSWORD_REQUIREMENTS[userType] || PASSWORD_REQUIREMENTS.client;
    const requirements = [];

    // Length requirement
    requirements.push({
        met: password.length >= config.minLength,
        text: `Mínimo ${config.minLength} caracteres`
    });

    // Lowercase requirement
    if (config.requireLowercase) {
        requirements.push({
            met: /[a-z]/.test(password),
            text: 'Una letra minúscula'
        });
    }

    // Uppercase requirement
    if (config.requireUppercase) {
        requirements.push({
            met: /[A-Z]/.test(password),
            text: 'Una letra mayúscula'
        });
    }

    // Number requirement
    if (config.requireNumber) {
        requirements.push({
            met: /[0-9]/.test(password),
            text: 'Un número'
        });
    }

    // Special character requirement
    if (config.requireSpecial) {
        requirements.push({
            met: /[^a-zA-Z0-9]/.test(password),
            text: 'Un carácter especial (!@#$%...)'
        });
    }

    const valid = requirements.every(req => req.met);
    return { valid, requirements };
}

/**
 * Calculate password strength
 * @param {string} password - Password to evaluate
 * @returns {Object} { score: number, level: string, text: string }
 */
export function calculatePasswordStrength(password) {
    let score = 0;

    if (!password) {
        return { score: 0, level: '', text: '' };
    }

    // Length checks
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Character variety
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    // Determine level
    let level, text;
    if (score <= 2) {
        level = 'weak';
        text = 'Débil';
    } else if (score <= 4) {
        level = 'medium';
        text = 'Media';
    } else {
        level = 'strong';
        text = 'Fuerte';
    }

    return { score, level, text };
}

/**
 * Update password strength UI
 * @param {string} password - Password to evaluate
 */
export function updatePasswordStrengthUI(password) {
    const container = document.getElementById('password-strength-container');
    const fill = document.getElementById('password-strength-fill');
    const textEl = document.getElementById('password-strength-text');
    const requirementsContainer = document.getElementById('password-requirements');

    if (!container || !fill || !textEl) return;

    if (!password) {
        container.classList.add('hidden');
        if (requirementsContainer) requirementsContainer.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    if (requirementsContainer) requirementsContainer.classList.remove('hidden');

    const { level, text } = calculatePasswordStrength(password);

    // Update fill bar
    fill.className = 'password-strength-fill';
    if (level) fill.classList.add(level);

    // Update text
    textEl.className = 'password-strength-text';
    if (level) textEl.classList.add(level);
    textEl.textContent = text;

    // Update requirements indicators
    if (requirementsContainer) {
        const lengthReq = requirementsContainer.querySelector('[data-req="length"]');
        const lowercaseReq = requirementsContainer.querySelector('[data-req="lowercase"]');
        const numberReq = requirementsContainer.querySelector('[data-req="number"]');

        if (lengthReq) {
            const met = password.length >= 8;
            lengthReq.classList.toggle('valid', met);
            lengthReq.classList.toggle('invalid', !met);
            lengthReq.querySelector('.material-icons').textContent = met ? 'check_circle' : 'radio_button_unchecked';
        }

        if (lowercaseReq) {
            const met = /[a-z]/.test(password);
            lowercaseReq.classList.toggle('valid', met);
            lowercaseReq.classList.toggle('invalid', !met);
            lowercaseReq.querySelector('.material-icons').textContent = met ? 'check_circle' : 'radio_button_unchecked';
        }

        if (numberReq) {
            const met = /[0-9]/.test(password);
            numberReq.classList.toggle('valid', met);
            numberReq.classList.toggle('invalid', !met);
            numberReq.querySelector('.material-icons').textContent = met ? 'check_circle' : 'radio_button_unchecked';
        }
    }
}

/**
 * Initialize password strength indicator
 */
export function initPasswordStrength() {
    const passwordInput = document.getElementById('register-password');
    if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
            updatePasswordStrengthUI(e.target.value);
        });
    }
}

// =======================================================
// EDICIÓN DE PERFIL
// =======================================================

/**
 * Abre el modal de edición de perfil
 */
export function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal || !state.currentUser) return;

    // Llenar el formulario con los datos actuales
    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    const phoneInput = document.getElementById('profile-phone');
    const currentPasswordInput = document.getElementById('profile-current-password');
    const newPasswordInput = document.getElementById('profile-new-password');

    if (nameInput) nameInput.value = state.currentUser.name || '';
    if (emailInput) emailInput.value = state.currentUser.email || '';
    if (phoneInput) phoneInput.value = state.currentUser.phone || '';
    if (currentPasswordInput) currentPasswordInput.value = '';
    if (newPasswordInput) newPasswordInput.value = '';

    modal.classList.remove('hidden');
}

/**
 * Cierra el modal de edición de perfil
 */
export function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Maneja la actualización del perfil
 */
export async function handleUpdateProfile(event) {
    event.preventDefault();

    const nameInput = document.getElementById('profile-name');
    const phoneInput = document.getElementById('profile-phone');
    const currentPasswordInput = document.getElementById('profile-current-password');
    const newPasswordInput = document.getElementById('profile-new-password');
    const submitBtn = document.getElementById('profile-submit-btn');

    const name = nameInput?.value?.trim();
    const phone = phoneInput?.value?.trim();
    const currentPassword = currentPasswordInput?.value;
    const newPassword = newPasswordInput?.value;

    // Validaciones
    if (name && (name.length < 2 || name.length > 50)) {
        ui.showToast('El nombre debe tener entre 2 y 50 caracteres', 'error');
        return;
    }

    if (newPassword && !currentPassword) {
        ui.showToast('Debes proporcionar tu contraseña actual para cambiarla', 'error');
        return;
    }

    if (newPassword && newPassword.length < 8) {
        ui.showToast('La nueva contraseña debe tener al menos 8 caracteres', 'error');
        return;
    }

    ui.setButtonLoadingState(submitBtn, true, 'Guardando...');

    try {
        const response = await authFetch(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                phone,
                currentPassword: currentPassword || undefined,
                newPassword: newPassword || undefined
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error al actualizar perfil');
        }

        // Actualizar estado del usuario
        if (data.user) {
            state.currentUser = { ...state.currentUser, ...data.user };
            sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.currentUser));

            // Actualizar UI con el nuevo nombre
            const userMenuName = document.getElementById('user-menu-name');
            if (userMenuName) {
                userMenuName.textContent = `Hola, ${state.currentUser.name.split(' ')[0]}`;
            }
        }

        ui.showToast('Perfil actualizado correctamente');
        closeProfileModal();

    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        ui.showToast(error.message || 'Error al actualizar perfil', 'error');
    } finally {
        ui.setButtonLoadingState(submitBtn, false, 'Guardar Cambios');
    }
}

/**
 * Inicializa los event listeners del modal de perfil
 */
export function initProfileModal() {
    const modal = document.getElementById('profile-modal');
    const form = document.getElementById('profile-form');
    const cancelBtn = document.getElementById('profile-cancel-btn');
    const closeBtn = modal?.querySelector('.close-modal-btn');

    form?.addEventListener('submit', handleUpdateProfile);
    cancelBtn?.addEventListener('click', closeProfileModal);
    closeBtn?.addEventListener('click', closeProfileModal);
}

// Initialize auth on module load
if (typeof window !== 'undefined') {
    // Defer initialization to avoid circular import issues
    setTimeout(() => {
        initAuth();
        initPasswordStrength();
        // initProfileModal is called from main.js to avoid duplicate listeners
    }, 0);
}
