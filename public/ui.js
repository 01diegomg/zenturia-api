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
    const mobileUserSection = document.getElementById('mobile-user-section');

    if (state.currentUser && state.currentUser.role === 'client') {
        // --- Usuario cliente ha iniciado sesión ---
        if (agendarBtn) agendarBtn.style.display = 'none';
        if (userMenuContainer) userMenuContainer.style.display = 'block';

        if (userMenuName) userMenuName.textContent = `Hola, ${state.currentUser.name.split(' ')[0]}`;
        if (welcomeMessage) welcomeMessage.innerHTML = `Bienvenido, <span class="text-yellow-500">${state.currentUser.name}</span>`;

        document.getElementById('user-portal-view')?.classList.remove('hidden');

        // Mostrar sección de usuario en menú móvil
        if (mobileUserSection) mobileUserSection.classList.remove('hidden');

    } else if (state.currentUser && state.currentUser.role === 'admin') {
        // --- Admin ha iniciado sesión ---
        if (agendarBtn) agendarBtn.style.display = 'none';
        if (userMenuContainer) userMenuContainer.style.display = 'none';
        if (mobileUserSection) mobileUserSection.classList.add('hidden');

    } else {
        // --- Nadie ha iniciado sesión ---
        if (agendarBtn) agendarBtn.style.display = 'inline-flex';
        if (userMenuContainer) userMenuContainer.style.display = 'none';

        document.getElementById('user-portal-view')?.classList.add('hidden');
        if (state.siteContent?.hero && welcomeMessage) {
            welcomeMessage.textContent = state.siteContent.hero.title;
        }

        // Ocultar sección de usuario en menú móvil
        if (mobileUserSection) mobileUserSection.classList.add('hidden');
    }
}

/**
 * Muestra la vista principal (cliente o admin) y oculta la otra.
 * @param {'client' | 'admin'} viewName - El nombre de la vista a mostrar.
 */
export function showView(viewName) {
    const agendarBtn = document.getElementById('agendar-btn');
    const mainNavLinks = document.querySelectorAll('.main-nav-link');
    const topBar = document.getElementById('top-bar');
    const header = document.querySelector('header');

    if (viewName === 'client') {
        clientMainView.classList.remove('hidden');
        adminMainView.classList.add('hidden');
        agendarBtn?.classList.remove('hidden');
        mainNavLinks.forEach(link => link.classList.remove('hidden'));
        // Mostrar cintillo en vista cliente
        if (topBar) {
            topBar.classList.remove('admin-hidden');
            if (window.scrollY <= 50) {
                topBar.classList.remove('top-bar-hidden');
                if (header) header.style.top = '37px';
            }
        }
    } else if (viewName === 'admin') {
        clientMainView.classList.add('hidden');
        adminMainView.classList.remove('hidden');
        agendarBtn?.classList.add('hidden');
        mainNavLinks.forEach(link => link.classList.add('hidden'));
        // Ocultar cintillo en vista admin
        if (topBar) {
            topBar.classList.add('top-bar-hidden', 'admin-hidden');
            if (header) header.style.top = '0';
        }
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

/**
 * Muestra un modal de resumen de reservación antes de confirmar
 * @param {Object} bookingData - Datos de la reservación
 * @param {Function} onConfirm - Callback cuando el usuario confirma
 * @param {Function} onCancel - Callback cuando el usuario cancela
 */
export function showBookingSummaryModal(bookingData, onConfirm, onCancel) {
    const { serviceName, servicePrice, date, time, barberName, barberPhoto } = bookingData;

    // Crear el modal dinámicamente
    const existingModal = document.getElementById('booking-summary-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'booking-summary-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content max-w-md">
            <button class="close-modal-btn" id="summary-close-btn">&times;</button>
            <h3 class="font-display text-2xl mb-6 text-center">Confirma tu Cita</h3>

            <div class="booking-summary">
                ${barberName ? `
                <div class="booking-summary-item">
                    <span class="booking-summary-label">Barbero</span>
                    <div class="booking-summary-barber">
                        ${barberPhoto ?
                            `<img src="${barberPhoto}" alt="${barberName}">` :
                            '<span class="material-icons text-2xl text-gray-400">person</span>'
                        }
                        <span class="booking-summary-value">${barberName}</span>
                    </div>
                </div>
                ` : ''}
                <div class="booking-summary-item">
                    <span class="booking-summary-label">Servicio</span>
                    <span class="booking-summary-value">${serviceName}</span>
                </div>
                <div class="booking-summary-item">
                    <span class="booking-summary-label">Fecha</span>
                    <span class="booking-summary-value">${date}</span>
                </div>
                <div class="booking-summary-item">
                    <span class="booking-summary-label">Hora</span>
                    <span class="booking-summary-value">${time}</span>
                </div>
                <div class="booking-summary-item">
                    <span class="booking-summary-label">Precio</span>
                    <span class="booking-summary-value text-accent">$${servicePrice}</span>
                </div>
            </div>

            <div class="flex gap-4 mt-6">
                <button id="summary-cancel-btn" class="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                    Volver
                </button>
                <button id="summary-confirm-btn" class="flex-1 px-4 py-3 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg transition-colors">
                    Confirmar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    };

    // Event listeners
    document.getElementById('summary-close-btn').addEventListener('click', () => {
        closeModal();
        if (onCancel) onCancel();
    });

    document.getElementById('summary-cancel-btn').addEventListener('click', () => {
        closeModal();
        if (onCancel) onCancel();
    });

    document.getElementById('summary-confirm-btn').addEventListener('click', () => {
        if (onConfirm) onConfirm(closeModal);
    });

    // Cerrar al hacer clic en el overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
            if (onCancel) onCancel();
        }
    });
}

/**
 * Muestra un skeleton loader en el calendario mientras carga
 * @param {HTMLElement} calendarGrid - El contenedor del calendario
 */
export function showCalendarSkeleton(calendarGrid) {
    if (!calendarGrid) return;

    calendarGrid.innerHTML = '';

    // Crear 35 celdas skeleton (5 semanas x 7 días)
    for (let i = 0; i < 35; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'calendar-day skeleton-loading';
        skeleton.innerHTML = '<div class="skeleton-pulse"></div>';
        calendarGrid.appendChild(skeleton);
    }
}

/**
 * Muestra un modal de éxito después de una reservación exitosa
 * @param {Object} bookingData - Datos de la reservación
 */
export function showBookingSuccessModal(bookingData) {
    const { serviceName, servicePrice, date, time, barberName } = bookingData;

    // Remover modal existente si hay
    const existingModal = document.getElementById('booking-success-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'booking-success-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content max-w-md text-center">
            <div class="success-animation mb-6">
                <div class="success-checkmark">
                    <span class="material-icons text-6xl text-green-500">check_circle</span>
                </div>
            </div>

            <h3 class="font-display text-2xl mb-4 text-white">¡Cita Confirmada!</h3>
            <p class="text-gray-400 mb-6">Tu reservación ha sido registrada exitosamente</p>

            <div class="booking-success-details bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
                <div class="flex justify-between mb-2">
                    <span class="text-gray-400">Servicio:</span>
                    <span class="text-white font-semibold">${serviceName}</span>
                </div>
                ${barberName ? `
                <div class="flex justify-between mb-2">
                    <span class="text-gray-400">Barbero:</span>
                    <span class="text-white">${barberName}</span>
                </div>
                ` : ''}
                <div class="flex justify-between mb-2">
                    <span class="text-gray-400">Fecha:</span>
                    <span class="text-white">${date}</span>
                </div>
                <div class="flex justify-between mb-2">
                    <span class="text-gray-400">Hora:</span>
                    <span class="text-accent font-bold">${time}</span>
                </div>
                <div class="flex justify-between pt-2 border-t border-gray-700">
                    <span class="text-gray-400">Total:</span>
                    <span class="text-accent font-bold text-lg">$${servicePrice}</span>
                </div>
            </div>

            <p class="text-sm text-gray-500 mb-6">
                <span class="material-icons text-sm align-middle mr-1">mail</span>
                Recibirás un correo con los detalles de tu cita
            </p>

            <button id="success-close-btn" class="modal-button">
                <span class="flex items-center justify-center gap-2">
                    <span class="material-icons">check</span>
                    Entendido
                </span>
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // Animación de entrada
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);

    // Event listener para cerrar
    const closeModal = () => {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    };

    document.getElementById('success-close-btn').addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/**
 * Muestra un modal de error genérico
 * @param {string} title - Título del error
 * @param {string} message - Mensaje de error
 */
export function showErrorModal(title, message) {
    const existingModal = document.getElementById('error-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'error-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content max-w-md text-center">
            <div class="mb-6">
                <span class="material-icons text-6xl text-red-500">error_outline</span>
            </div>
            <h3 class="font-display text-2xl mb-4 text-white">${title}</h3>
            <p class="text-gray-400 mb-6">${message}</p>
            <button id="error-close-btn" class="modal-button bg-red-600 hover:bg-red-700">Cerrar</button>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
    };

    document.getElementById('error-close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}
