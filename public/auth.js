// --- auth.js (Versión Final y Limpia) ---

import { API_BASE_URL, CONSTANTS } from './config.js';
import * as ui from './ui.js';
import { state } from './main.js';
import * as admin from './admin.js';


/**
 * Maneja el inicio de sesión del cliente desde el modal de reserva.
 * @returns {Promise<boolean>} Devuelve true si el inicio de sesión fue exitoso.
 */
export async function handleClientLogin() {
    const email = ui.bookingModal.querySelector('#login-email').value;
    const password = ui.bookingModal.querySelector('#login-password').value;
    const btn = ui.clientLoginBtn;

    if (!email || !password) {
        ui.showToast("Por favor, ingresa tu correo y contraseña.");
        return false;
    }
    
    ui.setButtonLoadingState(btn, true, "Iniciando Sesión...");

    try {
        const response = await fetch('http://localhost:3000/login/client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (response.ok) {
            state.currentUser = { ...data.user, role: CONSTANTS.ROLES.CLIENT };
            sessionStorage.setItem('barber_currentUser', JSON.stringify(state.currentUser));
            ui.updateUIAfterLogin();
            ui.showToast(`Bienvenido de nuevo, ${state.currentUser.name}`);
            return true;
        } else {
            ui.showToast(data.message);
            return false;
        }
    } catch (error) {
        console.error("Error en handleClientLogin:", error);
        ui.showToast("Error de conexión con el servidor.");
        return false;
    } finally {
        ui.setButtonLoadingState(btn, false, "Iniciar Sesión y Confirmar");
    }
}

/**
 * Maneja el registro de un nuevo cliente desde el modal de reserva.
 * @returns {Promise<boolean>} Devuelve true si el registro fue exitoso.
 */
export async function handleClientRegister() {
    const name = ui.bookingModal.querySelector('#register-name').value;
    const email = ui.bookingModal.querySelector('#register-email').value;
    const password = ui.bookingModal.querySelector('#register-password').value;
    const btn = ui.clientRegisterBtn;

    if (!name || !email || !password) {
        ui.showToast("Por favor, completa todos los campos.");
        return false;
    }
    
    ui.setButtonLoadingState(btn, true, "Registrando...");
    
    try {
        const response = await fetch('http://localhost:3000/register/client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await response.json();

        if (response.ok) {
            state.currentUser = { ...data.user, role: CONSTANTS.ROLES.CLIENT };
            sessionStorage.setItem('barber_currentUser', JSON.stringify(state.currentUser));
            ui.updateUIAfterLogin();
            ui.showToast(`¡Cuenta creada! Bienvenido, ${name}`);
            return true;
        } else {
            ui.showToast(data.message);
            return false;
        }
    } catch (error) {
        console.error("Error en handleClientRegister:", error);
        ui.showToast("Error de conexión con el servidor.");
        return false;
    } finally {
        ui.setButtonLoadingState(btn, false, "Registrarse y Confirmar");
    }
}

/**
 * Maneja el inicio de sesión del administrador.
 * @param {string} user El nombre de usuario del admin.
 * @param {string} pass La contraseña del admin.
 */
export async function handleAdminLogin(user, pass) {
    const btn = ui.adminLoginBtn;
    ui.setButtonLoadingState(btn, true, "Ingresando...");

    try {
        const response = await fetch('http://localhost:3000/login/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, pass }),
        });
        const data = await response.json();

        if (response.ok) {
            // Si el login es exitoso, se guarda el usuario admin en el estado y en la sesión
            state.currentUser = { name: 'Admin', role: CONSTANTS.ROLES.ADMIN };
            sessionStorage.setItem('barber_currentUser', JSON.stringify(state.currentUser));
            
            // Se actualiza la UI para reflejar el estado de login
            ui.closeAllModals();
            ui.updateUIAfterLogin();
            ui.showView('admin'); // Muestra la vista de administrador
            
            // Llama a la función principal para renderizar el panel de admin
            await admin.renderAdminView();
        } else {
            ui.showToast(data.message);
        }
    } catch (error) {
        console.error("Error de conexión en handleAdminLogin:", error);
        ui.showToast("No se pudo conectar al servidor. Inténtalo de nuevo.");
    } finally {
        ui.setButtonLoadingState(btn, false, "Ingresar");
    }
}

/**
 * Maneja el cierre de sesión del usuario (tanto cliente como admin).
 */
export function handleLogout() {
    // Limpia el estado y la sesión
    state.currentUser = null;
    sessionStorage.removeItem('barber_currentUser');
    
    ui.showToast("Has cerrado sesión.");
    
    // Recargar la página es la forma más robusta de asegurar que todos los estados
    // y vistas se reinicien correctamente a su estado inicial.
    window.location.reload();
}
