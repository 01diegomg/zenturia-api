// -- ui.js (Versión Final y Centralizada) --

import { CONSTANTS } from './config.js';
import { state } from './main.js';

// === SELECTORES DEL DOM (exportados para uso global) ===
export const clientMainView = document.getElementById('client-main-view');
export const adminMainView = document.getElementById('admin-main-view');
export const logoutBtn = document.getElementById('logout-btn');
export const welcomeMessage = document.getElementById('welcome-message');
export const heroSubtitle = document.getElementById('hero-subtitle');
export const aboutTextContainer = document.getElementById('about-text-container');
export const servicesListContainer = document.getElementById('services-list-container');
export const galleryContainer = document.getElementById('gallery-container');

// Selectores de Modales
export const bookingModal = document.getElementById('booking-modal-container');
export const adminLoginModal = document.getElementById('admin-login-modal');
export const adminDayModal = document.getElementById('admin-day-modal');
export const contentEditorModal = document.getElementById('content-editor-modal');
export const galleryEditorModal = document.getElementById('gallery-editor-modal');
export const overrideEditorModal = document.getElementById('override-editor-modal');
export const galleryLightboxModal = document.getElementById('gallery-lightbox-modal');
export const manualBookingModal = document.getElementById('manual-booking-modal');



// Selectores dentro del Modal de Reserva (Booking)
export const modalTitle = document.getElementById('modal-title');
export const serviceSelectionContainer = document.getElementById('service-selection-container');
export const timeSlotsContainer = document.getElementById('time-slots-container');
export const bookingNextBtn = document.getElementById('booking-next-btn');
export const bookingStep1 = document.getElementById('booking-step-1');
export const bookingStep2 = document.getElementById('booking-step-2');
export const clientLoginView = bookingModal?.querySelector('#client-login-view');
export const clientRegisterView = bookingModal?.querySelector('#client-register-view');
export const showRegisterBtn = bookingModal?.querySelector('#show-register-btn');
export const showLoginBtn = bookingModal?.querySelector('#show-login-btn');
export const clientLoginBtn = bookingModal?.querySelector('#client-login-btn');
export const clientRegisterBtn = bookingModal?.querySelector('#client-register-btn');

// Selectores de Admin
export const adminLoginBtn = document.getElementById('admin-login-btn');
export const adminLink = document.getElementById('admin-link');
export const inboxList = document.getElementById('inbox-list');
export const adminModalDate = document.getElementById('admin-modal-date');
export const adminModalList = document.getElementById('admin-modal-list');
export const adminServicesList = document.getElementById('admin-services-list');
export const adminGalleryList = document.getElementById('admin-gallery-list');

// Selectores de Calendarios
export const userCalendarGrid = document.getElementById('user-calendar-grid');
export const userMonthYearEl = document.getElementById('user-month-year');
export const userPrevMonthBtn = document.getElementById('user-prev-month-btn');
export const userNextMonthBtn = document.getElementById('user-next-month-btn');
export const adminCalendarGrid = document.getElementById('admin-calendar-grid');
export const adminMonthYearEl = document.getElementById('admin-month-year');
export const adminPrevMonthBtn = document.getElementById('admin-prev-month-btn');
export const adminNextMonthBtn = document.getElementById('admin-next-month-btn');


// === FUNCIÓN PARA APLICAR LA PALETA DE COLORES ===
/**
 * Aplica la paleta de colores a todo el sitio web actualizando las variables CSS en el elemento root.
 * @param {object} palette - Un objeto con los colores { accent, background, textMain, textSubtle }.
 */
export function applyPalette(palette) {
    const root = document.documentElement;
    if (!root || !palette) return;

    root.style.setProperty('--dorado-vintage', palette.accent);
    root.style.setProperty('--negro-intenso', palette.background);
    root.style.setProperty('--blanco-puro', palette.textMain);
    root.style.setProperty('--gris-suave', palette.textSubtle);

    const accentColor = palette.accent;
    const r = parseInt(accentColor.slice(1, 3), 16);
    const g = parseInt(accentColor.slice(3, 5), 16);
    const b = parseInt(accentColor.slice(5, 7), 16);
    const hoverColor = `rgb(${Math.min(255, r + 20)}, ${Math.min(255, g + 20)}, ${Math.min(255, b + 20)})`;
    root.style.setProperty('--acento-hover', hoverColor);
}


/**
 * Renderiza un calendario dinámico en el elemento grid especificado.
 * @param {HTMLElement} gridEl - El contenedor de la cuadrícula del calendario.
 * @param {HTMLElement} monthYearEl - El elemento para mostrar el mes y año.
 * @param {Date} date - La fecha a mostrar en el calendario.
 * @param {object} appointmentsSource - Un objeto con citas, donde las claves son 'YYYY-MM-DD'.
 */
// archivo: ui.js
export function renderCalendar(gridEl, monthYearEl, date, appointmentsSource) {
    if (!gridEl || !monthYearEl) return;
    
    gridEl.innerHTML = '';
    const month = date.getMonth();
    const year = date.getFullYear();
    monthYearEl.textContent = `${date.toLocaleString('es-ES', { month: 'long' })} ${year}`;
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < firstDayOfMonth; i++) {
        gridEl.insertAdjacentHTML('beforeend', '<div class="calendar-day empty"></div>');
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;
        
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayCell.dataset.dateKey = dateKey;
        
        const cellDate = new Date(year, month, day);
        if (cellDate < today) {
            dayCell.classList.add('past-day');
        }

        if (day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()) {
            dayCell.classList.add('current-day');
        }
        
        // LÓGICA MODIFICADA: El punto solo aparece si hay citas CONFIRMADAS
        const appointmentsForDay = appointmentsSource[dateKey] || [];
        const hasConfirmedAppointments = appointmentsForDay.some(app => app.status === 'CONFIRMED');

        if (hasConfirmedAppointments) {
            const dot = document.createElement('span');
            dot.className = 'appointment-dot';
            if (appointmentsForDay.filter(app => app.status === 'CONFIRMED').length >= 3) {
                 dot.classList.add('busy');
            }
            dayCell.appendChild(dot);
        }
        
        gridEl.appendChild(dayCell);
    }
}


// archivo: ui.js

export function updateUIAfterLogin() {
    const agendarBtn = document.getElementById('agendar-btn');
    const userMenuContainer = document.getElementById('user-menu-container');
    const userMenuName = document.getElementById('user-menu-name');
    const welcomeMessage = document.getElementById('welcome-message');

    if (state.currentUser && state.currentUser.role === 'client') {
        // --- Usuario cliente ha iniciado sesión ---
        if (agendarBtn) agendarBtn.style.display = 'none'; // <-- CAMBIO: Ocultamos directamente el botón
        if (userMenuContainer) userMenuContainer.style.display = 'block'; // <-- CAMBIO: Mostramos directamente el menú
        
        if (userMenuName) userMenuName.textContent = `Hola, ${state.currentUser.name.split(' ')[0]}`;
        if (welcomeMessage) welcomeMessage.innerHTML = `Bienvenido, <span class="text-yellow-500">${state.currentUser.name}</span>`;
        
        document.getElementById('user-portal-view')?.classList.remove('hidden');

    } else if (state.currentUser && state.currentUser.role === 'admin') {
        // --- Admin ha iniciado sesión ---
        if (agendarBtn) agendarBtn.style.display = 'none';
        if (userMenuContainer) userMenuContainer.style.display = 'none';

    } else {
        // --- Nadie ha iniciado sesión ---
        if (agendarBtn) agendarBtn.style.display = 'inline-flex'; // <-- CAMBIO: Restauramos su display original
        if (userMenuContainer) userMenuContainer.style.display = 'none'; // <-- CAMBIO: Ocultamos el menú
        
        document.getElementById('user-portal-view')?.classList.add('hidden');
        if (state.siteContent?.hero && welcomeMessage) {
            welcomeMessage.textContent = state.siteContent.hero.title;
        }
    }
}

/**
 * Muestra la vista principal (cliente o admin) y oculta la otra.
 * @param {'client' | 'admin'} viewName - El nombre de la vista a mostrar.
 */
export function showView(viewName) {
    const agendarBtn = document.getElementById('agendar-btn');
    const mainNavLinks = document.querySelectorAll('.main-nav-link');

    if (viewName === 'client') {
        clientMainView.classList.remove('hidden');
        adminMainView.classList.add('hidden');
        agendarBtn?.classList.remove('hidden');
        mainNavLinks.forEach(link => link.classList.remove('hidden'));
    } else if (viewName === 'admin') {
        clientMainView.classList.add('hidden');
        adminMainView.classList.remove('hidden');
        agendarBtn?.classList.add('hidden');
        mainNavLinks.forEach(link => link.classList.add('hidden'));
    }
}

/**
 * Cierra todos los modales abiertos en la aplicación.
 */
// archivo: ui.js

export function closeAllModals() {
    // Añade 'manualBookingModal' al array
    const modals = [bookingModal, adminLoginModal, adminDayModal, contentEditorModal, galleryEditorModal, overrideEditorModal, galleryLightboxModal, manualBookingModal];
    modals.forEach(modal => {
        if (modal) {
            modal.classList.add('hidden');
        }
    });
}

/**
 * Muestra un mensaje emergente (toast) en la esquina inferior derecha.
 * @param {string} message - El mensaje a mostrar.
 */
export function showToast(message) {
    console.log(`DEBUG: showToast llamado con el mensaje: "${message}"`);
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error("DEBUG: ¡El contenedor del toast no fue encontrado!");
        return;
    }
    
    const toast = document.createElement('div');
    toast.textContent = message;
    
    // Estilos directos para máxima compatibilidad y visibilidad
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = '#FBBF24'; // Amarillo de Tailwind
    toast.style.color = 'black';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
    toast.style.zIndex = '9999';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease-in-out';

    container.appendChild(toast);
    console.log("DEBUG: Elemento toast añadido al contenedor.", toast);

    // Animar entrada
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    // Animar salida y eliminar
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.addEventListener('transitionend', () => {
            console.log("DEBUG: Toast eliminado.");
            toast.remove();
        });
    }, 3000);
}

/**
 * Cambia el estado de un botón a "cargando" (deshabilitado con spinner).
 * @param {HTMLElement} button - El botón a modificar.
 * @param {boolean} isLoading - True para mostrar el estado de carga, false para revertir.
 * @param {string} [loadingText=''] - El texto a mostrar mientras carga.
 */
export function setButtonLoadingState(button, isLoading, loadingText = '') {
    if (!button) return;
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.innerHTML = `
            <span class="flex items-center justify-center">
                ${loadingText || button.dataset.originalText}
                <span class="spinner ml-2"></span>
            </span>`;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText;
    }
}
