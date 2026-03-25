// =======================================================
//         ARCHIVO COMPLETO Y CORREGIDO: admin.js
// =======================================================
import * as ui from './ui.js';
import { state } from './main.js';
import { API_BASE_URL, fetchWithRetry, handleResponseError, ERROR_MESSAGES } from './config.js';
import * as client from './client.js';
import { escapeHtml, sanitizeUrl } from './js/sanitizer.js';

// === TEMAS PREDEFINIDOS PARA LA PALETA DE COLORES ===
const THEME_PRESETS = {
    clasico: {
        name: "Clásico",
        colors: { accent: "#CFAF7C", background: "#0a0a0a", textMain: "#FFFFFF", textSubtle: "#cccccc" }
    },
    neon: {
        name: "Neón Nocturno",
        colors: { accent: "#33FFBD", background: "#0D0221", textMain: "#F0F2F5", textSubtle: "#A4A6AB" }
    },
    cafe: {
        name: "Café Vintage",
        colors: { accent: "#E0A458", background: "#26170F", textMain: "#FDF6EC", textSubtle: "#D3C5BC" }
    },
    oceanico: {
        name: "Oceánico",
        colors: { accent: "#57B8FF", background: "#001D3D", textMain: "#FFFFFF", textSubtle: "#C5DAE8" }
    }
};


// =======================================================
// FUNCIONES DE RENDERIZADO DEL PANEL DE ADMIN
// =======================================================

export async function renderAdminView() {
    try {
        await Promise.all([
            client.fetchAllAppointments(),
            client.fetchSiteContent(),
            fetchScheduleOverrides()
        ]);

        // Mostrar banner si el sitio no está configurado
        renderConfigurationBanner();

        renderAdminContentView();
        renderScheduleEditor();
        renderOverrideCalendar();
        renderInbox();
        ui.renderCalendar(ui.adminCalendarGrid, ui.adminMonthYearEl, state.currentAdminDate, state.allAppointments);

        setupAdminEventListeners();
        setupAdminSidebar();

    } catch (error) {
        console.error("Error crítico al renderizar la vista de admin:", error);
        ui.showToast("No se pudieron cargar los datos del panel. Intenta recargar.");
        ui.adminMainView.innerHTML = `<p class="text-red-500 text-center p-8">Error al cargar el panel de administración. Revisa la conexión con el servidor.</p>`;
    }
}

/**
 * Muestra un banner de advertencia si el sitio no está configurado
 */
function renderConfigurationBanner() {
    // Remover banner existente si lo hay
    const existingBanner = document.getElementById('config-warning-banner');
    if (existingBanner) existingBanner.remove();

    // Solo mostrar si no está configurado
    if (state.siteContent?.isConfigured) return;

    const banner = document.createElement('div');
    banner.id = 'config-warning-banner';
    banner.className = 'config-warning-banner';
    banner.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="material-icons text-2xl">warning</span>
            <div>
                <strong>Configuración pendiente</strong>
                <p class="text-sm opacity-80">Tu sitio está usando contenido de ejemplo. Configura tu negocio para personalizarlo.</p>
            </div>
        </div>
        <button id="open-wizard-btn" class="config-banner-btn">
            <span class="material-icons text-sm">settings</span>
            Configurar Ahora
        </button>
    `;

    // Insertar después del título del panel admin
    const adminTitle = ui.adminMainView.querySelector('h2');
    if (adminTitle) {
        adminTitle.insertAdjacentElement('afterend', banner);
    }

    // Event listener para abrir el wizard
    document.getElementById('open-wizard-btn')?.addEventListener('click', () => {
        const wizardModal = document.getElementById('setup-wizard-modal');
        if (wizardModal) wizardModal.classList.remove('hidden');
    });
}

function renderAdminContentView() {
    renderAdminBusinessForm();
    renderAdminPaletteEditor();
    renderAdminTextsForm();
    renderAdminHeroBackgroundForm();
    renderAdminAboutSectionForm();
    renderAdminServicesList();
    renderAdminGalleryList();
    renderAdminLocationForm();
}

function renderAdminBusinessForm() {
    const business = state.siteContent?.business;
    const social = state.siteContent?.social;

    if (business) {
        const nameInput = document.getElementById('edit-business-name');
        const logoInput = document.getElementById('edit-business-logo');
        const phoneInput = document.getElementById('edit-business-phone');
        const whatsappInput = document.getElementById('edit-business-whatsapp');

        if (nameInput) nameInput.value = business.name || '';
        if (logoInput) logoInput.value = business.logo || '';
        if (phoneInput) phoneInput.value = business.phone || '';
        if (whatsappInput) whatsappInput.value = business.whatsapp || '';
    }

    if (social) {
        const instagramInput = document.getElementById('edit-social-instagram');
        const facebookInput = document.getElementById('edit-social-facebook');
        const tiktokInput = document.getElementById('edit-social-tiktok');

        if (instagramInput) instagramInput.value = social.instagram || '';
        if (facebookInput) facebookInput.value = social.facebook || '';
        if (tiktokInput) tiktokInput.value = social.tiktok || '';
    }
}

// Estado de paginación para el inbox
const inboxPagination = {
    currentPage: 1,
    limit: 10,
    total: 0,
    totalPages: 0
};

/**
 * Renderiza el inbox con paginación
 * @param {number} page - Página a mostrar
 */
async function renderInbox(page = 1) {
    if (!ui.inboxList) return;

    // Mostrar skeleton mientras carga
    ui.inboxList.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p class="loading-text">Cargando citas...</p>
        </div>
    `;

    try {
        // Obtener citas paginadas del servidor
        const result = await client.fetchPaginatedAppointments({
            page,
            limit: inboxPagination.limit,
            status: 'CONFIRMED',
            upcoming: true
        });

        // Actualizar estado de paginación
        if (result.pagination) {
            inboxPagination.currentPage = result.pagination.page;
            inboxPagination.total = result.pagination.total;
            inboxPagination.totalPages = result.pagination.totalPages;
        }

        ui.inboxList.innerHTML = '';

        // Obtener citas del resultado
        const appointments = result.appointments || result;
        const allApps = Object.values(appointments).flat();

        if (allApps.length === 0) {
            ui.inboxList.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">event_available</span>
                    <p>${page > 1 ? 'No hay más citas en esta página' : 'No hay citas próximas programadas'}</p>
                </div>
            `;
            // Si estamos en una página sin resultados, ir a la anterior
            if (page > 1 && allApps.length === 0) {
                renderInbox(page - 1);
            }
            return;
        }

        // Ordenar por fecha y hora
        allApps.sort((a, b) => new Date(a.dateKey + 'T' + a.time) - new Date(b.dateKey + 'T' + b.time));

        // Renderizar cada cita
        allApps.forEach(app => {
            const date = new Date(app.dateKey + 'T' + app.time);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const appDateOnly = new Date(app.dateKey);

            // Calcular si es hoy, mañana, o más adelante
            const diffDays = Math.ceil((appDateOnly - today) / (1000 * 60 * 60 * 24));
            let dateLabel = '';
            if (diffDays === 0) {
                dateLabel = '<span class="text-green-400 font-semibold">Hoy</span>';
            } else if (diffDays === 1) {
                dateLabel = '<span class="text-yellow-400">Mañana</span>';
            } else {
                dateLabel = `<span class="text-gray-400">${escapeHtml(date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }))}</span>`;
            }

            const card = document.createElement('div');
            card.className = 'inbox-item';
            card.innerHTML = `
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="material-icons text-accent text-sm">person</span>
                        <span class="font-semibold text-white">${escapeHtml(app.userName)}</span>
                    </div>
                    <p class="text-gray-400 text-sm">${escapeHtml(app.serviceName)}</p>
                </div>
                <div class="text-right">
                    <div class="text-sm">${dateLabel}</div>
                    <p class="text-accent font-bold">${escapeHtml(app.time)}</p>
                </div>
            `;
            ui.inboxList.appendChild(card);
        });

        // Renderizar controles de paginación si hay más de una página
        if (result.pagination && result.pagination.totalPages > 1) {
            renderInboxPagination(result.pagination);
        }

    } catch (error) {
        console.error('Error al cargar citas paginadas:', error);
        // Fallback: usar el método anterior con datos locales
        renderInboxFallback();
    }
}

/**
 * Renderiza los controles de paginación
 * @param {Object} pagination - Metadata de paginación
 */
function renderInboxPagination(pagination) {
    const paginationEl = document.createElement('div');
    paginationEl.className = 'inbox-pagination';
    paginationEl.innerHTML = `
        <button class="pagination-btn ${!pagination.hasPrevPage ? 'disabled' : ''}"
                data-action="prev" ${!pagination.hasPrevPage ? 'disabled' : ''}>
            <span class="material-icons">chevron_left</span>
        </button>
        <span class="pagination-info">
            ${pagination.page} / ${pagination.totalPages}
            <span class="pagination-total">(${pagination.total} citas)</span>
        </span>
        <button class="pagination-btn ${!pagination.hasNextPage ? 'disabled' : ''}"
                data-action="next" ${!pagination.hasNextPage ? 'disabled' : ''}>
            <span class="material-icons">chevron_right</span>
        </button>
    `;

    // Agregar event listeners
    paginationEl.querySelector('[data-action="prev"]')?.addEventListener('click', () => {
        if (pagination.hasPrevPage) {
            renderInbox(pagination.page - 1);
        }
    });
    paginationEl.querySelector('[data-action="next"]')?.addEventListener('click', () => {
        if (pagination.hasNextPage) {
            renderInbox(pagination.page + 1);
        }
    });

    ui.inboxList.appendChild(paginationEl);
}

/**
 * Fallback para renderizar inbox con datos locales (sin paginación del servidor)
 */
function renderInboxFallback() {
    if (!ui.inboxList) return;
    ui.inboxList.innerHTML = '';

    const allApps = Object.values(state.allAppointments).flat();
    const upcomingApps = allApps
        .filter(app => new Date(app.dateKey) >= new Date() && app.status !== 'CANCELLED')
        .sort((a, b) => new Date(a.dateKey + 'T' + a.time) - new Date(b.dateKey + 'T' + b.time));

    if (upcomingApps.length === 0) {
        ui.inboxList.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">event_available</span>
                <p>No hay citas próximas programadas</p>
            </div>
        `;
        return;
    }

    // Mostrar solo las próximas 10 citas
    upcomingApps.slice(0, 10).forEach(app => {
        const date = new Date(app.dateKey + 'T' + app.time);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const appDateOnly = new Date(app.dateKey);

        const diffDays = Math.ceil((appDateOnly - today) / (1000 * 60 * 60 * 24));
        let dateLabel = '';
        if (diffDays === 0) {
            dateLabel = '<span class="text-green-400 font-semibold">Hoy</span>';
        } else if (diffDays === 1) {
            dateLabel = '<span class="text-yellow-400">Mañana</span>';
        } else {
            dateLabel = `<span class="text-gray-400">${escapeHtml(date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }))}</span>`;
        }

        const card = document.createElement('div');
        card.className = 'inbox-item';
        card.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                    <span class="material-icons text-accent text-sm">person</span>
                    <span class="font-semibold text-white">${escapeHtml(app.userName)}</span>
                </div>
                <p class="text-gray-400 text-sm">${escapeHtml(app.serviceName)}</p>
            </div>
            <div class="text-right">
                <div class="text-sm">${dateLabel}</div>
                <p class="text-accent font-bold">${escapeHtml(app.time)}</p>
            </div>
        `;
        ui.inboxList.appendChild(card);
    });

    if (upcomingApps.length > 10) {
        const moreText = document.createElement('p');
        moreText.className = 'text-center text-gray-500 text-sm mt-3';
        moreText.textContent = `+${upcomingApps.length - 10} citas más`;
        ui.inboxList.appendChild(moreText);
    }
}

// archivo: admin.js
export async function openAdminDayModal(dateKey) {
    const date = new Date(dateKey + 'T00:00:00Z');
    ui.adminModalDate.textContent = `Agenda para el ${date.toLocaleDateString('es-ES', { dateStyle: 'full', timeZone: 'UTC' })}`;

    // Mostrar estado de carga con spinner
    ui.adminModalList.innerHTML = `
        <div class="admin-loading-container">
            <div class="loading-spinner-admin"></div>
            <p class="text-gray-400 mt-3">Cargando disponibilidad...</p>
        </div>
    `;
    ui.adminDayModal.classList.remove('hidden');

    try {
        // 1. Obtenemos los horarios disponibles con timeout y retry
        const response = await fetchWithRetry(
            `${API_BASE_URL}/appointments/available-slots?date=${dateKey}`,
            { method: 'GET' },
            2, // reintentos
            10000 // timeout 10s
        );

        if (!response.ok) {
            const errorInfo = await handleResponseError(response);
            throw errorInfo;
        }

        const availableSlots = await response.json();

        // 2. Obtenemos las citas ya agendadas para ese día
        const bookedAppointments = state.allAppointments[dateKey] || [];

        // 3. Creamos la línea de tiempo completa
        const allSlots = new Set([...availableSlots, ...bookedAppointments.map(a => a.time)]);
        const sortedSlots = Array.from(allSlots).sort();

        ui.adminModalList.innerHTML = ''; // Limpiamos el "Cargando..."

        if (sortedSlots.length === 0) {
            ui.adminModalList.innerHTML = '<p class="text-gray-500 text-center py-4">Este día está marcado como no laborable.</p>';
            return;
        }

        sortedSlots.forEach(time => {
            const slotDiv = document.createElement('div');
            const bookedApp = bookedAppointments.find(app => app.time === time);

            if (bookedApp) {
                // Es una cita agendada
                const isCancelled = bookedApp.status === 'CANCELLED';
                slotDiv.className = `admin-appointment-card day-time-slot booked ${isCancelled ? 'cancelled-appointment' : ''}`;
                slotDiv.dataset.appointmentId = bookedApp.id;
                slotDiv.dataset.dateKey = dateKey;
                slotDiv.innerHTML = `
                    <div class="flex-1">
                        <p class="font-bold text-white">${escapeHtml(bookedApp.time)} - ${escapeHtml(bookedApp.serviceName)}</p>
                        <p class="text-sm text-gray-400">${escapeHtml(bookedApp.userName)} • ${escapeHtml(bookedApp.userEmail || '')}</p>
                    </div>
                    ${isCancelled
                        ? '<span class="font-semibold text-red-500 flex items-center gap-1"><span class="material-icons text-sm">cancel</span>CANCELADA</span>'
                        : `<div class="flex items-center gap-2">
                            <button class="delete-appointment-btn p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg transition-colors" title="Cancelar cita">
                                <span class="material-icons text-red-400">close</span>
                            </button>
                           </div>
                           <div class="appointment-confirm-delete hidden absolute inset-0 bg-black/90 rounded-lg flex items-center justify-center gap-3 p-4">
                               <span class="text-white text-sm">¿Cancelar esta cita?</span>
                               <button class="confirm-delete-btn px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm">Sí</button>
                               <button class="cancel-delete-btn px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm">No</button>
                           </div>`
                    }
                `;
            } else {
                // Es un horario disponible
                slotDiv.className = 'day-time-slot available';
                slotDiv.dataset.time = time;
                slotDiv.dataset.dateKey = dateKey;
                slotDiv.innerHTML = `
                    <span class="font-bold text-green-400">${escapeHtml(time)}</span>
                    <span class="font-semibold text-green-400">Disponible</span>
                `;
            }
            ui.adminModalList.appendChild(slotDiv);
        });

    } catch (error) {
        console.error("Error al construir la agenda del día:", error);

        // Mensaje específico según el tipo de error
        let errorMessage = 'No se pudo cargar la disponibilidad del día.';
        let errorIcon = 'error';

        if (error.type === 'TIMEOUT') {
            errorMessage = 'La conexión tardó demasiado. Verifica tu internet.';
            errorIcon = 'timer_off';
        } else if (error.type === 'NETWORK') {
            errorMessage = 'Sin conexión a internet.';
            errorIcon = 'wifi_off';
        } else if (error.status >= 500) {
            errorMessage = 'Error del servidor. Intenta más tarde.';
            errorIcon = 'cloud_off';
        }

        ui.adminModalList.innerHTML = `
            <div class="admin-error-container">
                <span class="material-icons text-4xl text-red-400 mb-2">${errorIcon}</span>
                <p class="text-red-400 mb-3">${errorMessage}</p>
                <button type="button" class="retry-admin-btn" id="retry-day-modal-btn">
                    <span class="material-icons">refresh</span>
                    Reintentar
                </button>
            </div>
        `;

        // Agregar evento de reintento
        document.getElementById('retry-day-modal-btn')?.addEventListener('click', () => {
            openAdminDayModal(dateKey);
        });
    }
}

// --- Funciones para renderizar sub-componentes ---

function renderAdminPaletteEditor() {
    const palette = state.siteContent?.palette;
    if (!palette) return;

    document.getElementById('color-accent').value = palette.accent;
    document.getElementById('color-background').value = palette.background;
    document.getElementById('color-text-main').value = palette.textMain;
    document.getElementById('color-text-subtle').value = palette.textSubtle;

    const presetsContainer = document.getElementById('theme-presets-container');
    presetsContainer.innerHTML = '';
    for (const themeKey in THEME_PRESETS) {
        const theme = THEME_PRESETS[themeKey];
        const button = document.createElement('button');
        button.className = 'theme-preset-btn';
        button.textContent = theme.name;
        button.dataset.theme = themeKey;
        presetsContainer.appendChild(button);
    }
}

function renderAdminTextsForm() {
    if (state.siteContent?.hero) {
        document.getElementById('edit-hero-title').value = state.siteContent.hero.title;
        document.getElementById('edit-hero-subtitle').value = state.siteContent.hero.subtitle;
    }
}

function renderAdminHeroBackgroundForm() {
     if (state.siteContent?.hero) {
        const bgType = state.siteContent.hero.backgroundType;
        const bgValue = state.siteContent.hero.backgroundValue;
        if (bgType === 'COLOR') {
            document.getElementById('bg-type-color').checked = true;
            document.getElementById('hero-bg-color').value = bgValue;
            document.getElementById('hero-bg-image-controls').classList.add('hidden');
            document.getElementById('hero-bg-color-controls').classList.remove('hidden');
        } else {
            document.getElementById('bg-type-image').checked = true;
            document.getElementById('hero-bg-image-controls').classList.remove('hidden');
            document.getElementById('hero-bg-color-controls').classList.add('hidden');
        }
    }
}

function renderAdminAboutSectionForm() {
    if (state.siteContent?.about) {
        document.getElementById('edit-about-text-2').value = state.siteContent.about.text.replace(/<br>/g, "\n");
    }
}

function renderAdminLocationForm() {
    if (state.siteContent?.location) {
        document.getElementById('edit-location-address').value = state.siteContent.location.address.replace(/<br>/g, "\n");
        document.getElementById('edit-location-schedule').value = state.siteContent.location.schedule.replace(/<br>/g, "\n");
        document.getElementById('edit-location-map').value = state.siteContent.location.mapUrl;
    }
}

function renderAdminServicesList() {
    if (!ui.adminServicesList || !state.siteContent?.services) return;
    ui.adminServicesList.innerHTML = '';
    state.siteContent.services.forEach(service => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center p-3 bg-gray-800 rounded-md';
        div.innerHTML = `
            <div>
                <p class="font-semibold text-white">${escapeHtml(service.name)}</p>
                <p class="text-sm text-gray-400">$${escapeHtml(String(service.price))} - ${escapeHtml(String(service.duration))} min</p>
            </div>
            <div class="flex gap-2">
                <button data-id="${escapeHtml(service.id)}" class="edit-service-btn p-2 hover:bg-gray-700 rounded-full"><span class="material-icons text-blue-400">edit</span></button>
                <button data-id="${escapeHtml(service.id)}" class="delete-service-btn p-2 hover:bg-gray-700 rounded-full"><span class="material-icons text-red-500">delete</span></button>
            </div>
        `;
        ui.adminServicesList.appendChild(div);
    });
}

function renderAdminGalleryList() {
    if (!ui.adminGalleryList || !state.siteContent?.gallery) return;
    ui.adminGalleryList.innerHTML = '';
    state.siteContent.gallery.forEach(image => {
        const div = document.createElement('div');
        div.className = 'relative aspect-square overflow-hidden rounded-md';
        const safeUrl = sanitizeUrl(image.url) || '';
        div.innerHTML = `
            <img src="${safeUrl}" alt="${escapeHtml(image.altText)}" class="w-full h-full object-cover">
            <button data-id="${escapeHtml(image.id)}" class="delete-gallery-btn absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 leading-none">
                <span class="material-icons text-sm">close</span>
            </button>
        `;
        ui.adminGalleryList.appendChild(div);
    });
}

// =======================================================
// LÓGICA DE GUARDADO Y ELIMINACIÓN
// =======================================================

async function handleSaveBusiness() {
    const btn = document.getElementById('save-business-btn');
    ui.setButtonLoadingState(btn, true, 'Guardando...');

    const businessData = {
        name: document.getElementById('edit-business-name')?.value?.trim(),
        logo: document.getElementById('edit-business-logo')?.value?.trim(),
        phone: document.getElementById('edit-business-phone')?.value?.trim(),
        whatsapp: document.getElementById('edit-business-whatsapp')?.value?.trim()
    };

    const socialData = {
        instagram: document.getElementById('edit-social-instagram')?.value?.trim(),
        facebook: document.getElementById('edit-social-facebook')?.value?.trim(),
        tiktok: document.getElementById('edit-social-tiktok')?.value?.trim()
    };

    try {
        // Validar nombre del negocio
        if (!businessData.name || businessData.name.length < 2) {
            ui.showToast('El nombre del negocio debe tener al menos 2 caracteres.');
            return;
        }

        // Guardar info del negocio
        const businessResponse = await fetch(`${API_BASE_URL}/content/business`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('barber_accessToken')}`
            },
            body: JSON.stringify(businessData)
        });

        if (!businessResponse.ok) {
            const err = await businessResponse.json();
            throw new Error(err.message || 'Error al guardar información del negocio');
        }

        // Guardar redes sociales
        const socialResponse = await fetch(`${API_BASE_URL}/content/social`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('barber_accessToken')}`
            },
            body: JSON.stringify(socialData)
        });

        if (!socialResponse.ok) {
            const err = await socialResponse.json();
            throw new Error(err.message || 'Error al guardar redes sociales');
        }

        ui.showToast('Configuración del negocio guardada correctamente.');

        // Actualizar estado y re-renderizar
        await client.fetchSiteContent();
        client.renderPublicSite();

    } catch (error) {
        console.error('Error guardando configuración:', error);
        ui.showToast(error.message || 'Error de conexión al guardar.');
    } finally {
        ui.setButtonLoadingState(btn, false, 'Guardar Configuración');
    }
}

async function handleSavePalette() {
    const btn = document.getElementById('save-palette-btn');
    ui.setButtonLoadingState(btn, true, 'Guardando...');
    const paletteData = {
        accent: document.getElementById('color-accent').value,
        background: document.getElementById('color-background').value,
        textMain: document.getElementById('color-text-main').value,
        textSubtle: document.getElementById('color-text-subtle').value
    };
    try {
        const response = await fetch(`${API_BASE_URL}/content/palette`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('barber_accessToken')}`
            },
            body: JSON.stringify(paletteData)
        });
        const result = await response.json();
        ui.showToast(result.message);
        if (response.ok) {
            await client.fetchSiteContent();
            ui.applyPalette(state.siteContent.palette);
        }
    } catch (error) {
        ui.showToast('Error de conexión al guardar la paleta.');
    } finally {
        ui.setButtonLoadingState(btn, false, 'Guardar Paleta de Colores');
    }
}

// archivo: admin.js

export async function handleDeleteAppointment(appointmentId, cardElement, confirmButton) {
    // Deshabilitar todos los botones del diálogo para evitar doble clic
    const confirmDialog = cardElement.querySelector('.appointment-confirm-delete');
    const cancelBtn = confirmDialog?.querySelector('.cancel-delete-btn');

    if (confirmButton) confirmButton.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    // Mostrar estado de carga
    ui.setButtonLoadingState(confirmButton, true, 'Cancelando...');

    // Agregar clase de procesando al card
    cardElement.classList.add('processing-cancellation');

    try {
        const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}?cancelledBy=admin`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('barber_accessToken')}`
            }
        });
        const result = await response.json();

        if (response.ok) {
            // Mostrar animación de éxito en el card
            cardElement.classList.remove('processing-cancellation');
            cardElement.classList.add('cancellation-success');

            // Actualizar el diálogo de confirmación con mensaje de éxito
            if (confirmDialog) {
                confirmDialog.innerHTML = `
                    <div class="cancellation-success-message">
                        <span class="material-icons text-green-400 text-2xl">check_circle</span>
                        <span class="text-green-400">Cita cancelada</span>
                    </div>
                `;
            }

            // Esperar un momento para que el usuario vea el feedback
            await new Promise(resolve => setTimeout(resolve, 800));

            // Actualizar estado local
            const dateKey = cardElement.dataset.dateKey;
            const appointment = state.allAppointments[dateKey]?.find(app => app.id === appointmentId);
            if (appointment) {
                appointment.status = 'CANCELLED';
            }

            // Re-renderizar vistas
            openAdminDayModal(dateKey);
            ui.renderCalendar(ui.adminCalendarGrid, ui.adminMonthYearEl, state.currentAdminDate, state.allAppointments);
            renderInbox();

            // Mostrar toast de éxito
            ui.showToast('Cita cancelada exitosamente', 'success');
        } else {
            throw new Error(result.message || 'Error al cancelar');
        }
    } catch (error) {
        console.error("Error al cancelar la cita:", error);

        // Mostrar error en el diálogo
        cardElement.classList.remove('processing-cancellation');
        cardElement.classList.add('cancellation-error');

        if (confirmDialog) {
            confirmDialog.innerHTML = `
                <div class="cancellation-error-message">
                    <span class="material-icons text-red-400">error</span>
                    <span class="text-red-400 text-sm">Error al cancelar</span>
                    <button class="retry-cancel-btn mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
                        Reintentar
                    </button>
                    <button class="close-cancel-btn mt-2 px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm">
                        Cerrar
                    </button>
                </div>
            `;

            // Agregar listeners para los nuevos botones
            confirmDialog.querySelector('.retry-cancel-btn')?.addEventListener('click', () => {
                // Restaurar el diálogo original
                const dateKey = cardElement.dataset.dateKey;
                openAdminDayModal(dateKey);
            });
            confirmDialog.querySelector('.close-cancel-btn')?.addEventListener('click', () => {
                cardElement.classList.remove('cancellation-error', 'confirming-delete');
                confirmDialog.classList.add('hidden');
            });
        }

        ui.showToast(error.message || "Error de conexión al cancelar la cita.", 'error');
    }
}

// Helper para obtener headers con autenticación
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('barber_accessToken')}`
    };
}

export async function handleSaveTexts() {
    const btn = document.getElementById('save-texts-btn');
    ui.setButtonLoadingState(btn, true, 'Guardando...');
    const textData = {
        heroTitle: document.getElementById('edit-hero-title').value,
        heroSubtitle: document.getElementById('edit-hero-subtitle').value,
    };
    try {
        const response = await fetch(`${API_BASE_URL}/content/texts`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(textData)
        });
        const result = await response.json();
        ui.showToast(result.message);
        if (response.ok) {
            await client.fetchSiteContent();
            client.renderPublicSite();
        }
    } catch (error) {
        ui.showToast('Error de conexión al guardar los textos.');
    } finally {
        ui.setButtonLoadingState(btn, false, 'Guardar Textos');
    }
}

// =======================================================
// === FUNCIONES DE SUBIDA DE IMAGEN CORREGIDAS (Cloudinary) ===
// =======================================================

export async function handleSaveHeroBackground() {
    const btn = document.getElementById('save-hero-bg-btn');
    ui.setButtonLoadingState(btn, true, 'Guardando...');
    const bgType = document.querySelector('input[name="bg-type"]:checked').value;
    let bgValue;
    try {
        if (bgType === 'IMAGE') {
            const fileInput = document.getElementById('hero-bg-file');
            if (fileInput.files.length > 0) {
                // PRIMERO, subimos la imagen a nuestro endpoint /upload
                const formData = new FormData();
                formData.append('image', fileInput.files[0]);
                const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('barber_accessToken')}` },
                    body: formData
                });
                const uploadData = await uploadResponse.json();
                if (!uploadData.success) throw new Error('Falló la subida de la imagen.');
                bgValue = uploadData.url; // Usamos la URL de Cloudinary
            } else {
                // Si no se selecciona archivo nuevo, se mantiene el actual
                bgValue = state.siteContent.hero.backgroundValue;
            }
        } else {
            bgValue = document.getElementById('hero-bg-color').value;
        }
        // SEGUNDO, guardamos el contenido con la nueva URL o color
        const response = await fetch(`${API_BASE_URL}/content/hero-background`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ type: bgType, value: bgValue })
        });
        const result = await response.json();
        ui.showToast(result.message);
        if (response.ok) {
            await client.fetchSiteContent();
            client.renderPublicSite();
        }
    } catch (error) {
        ui.showToast(error.message || "Error al guardar el fondo.");
    } finally {
        ui.setButtonLoadingState(btn, false, 'Guardar Cambios de Fondo');
    }
}

export async function handleSaveAboutSection() {
    const btn = document.getElementById('save-about-section-btn');
    ui.setButtonLoadingState(btn, true, 'Guardando...');
    let imageUrl = state.siteContent.about.image; // Mantenemos la imagen actual por defecto
    try {
        const fileInput = document.getElementById('about-image-file');
        if (fileInput.files.length > 0) {
            // PRIMERO, si hay un archivo nuevo, lo subimos
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${sessionStorage.getItem('barber_accessToken')}` },
                body: formData
            });
            const uploadData = await uploadResponse.json();
            if (!uploadData.success) throw new Error('Falló la subida de la imagen.');
            imageUrl = uploadData.url; // Usamos la URL de Cloudinary
        }
        const aboutData = {
            text: document.getElementById('edit-about-text-2').value.replace(/\n/g, '<br>'),
            image: imageUrl
        };
        // SEGUNDO, guardamos el contenido (con la URL nueva o la antigua)
        const response = await fetch(`${API_BASE_URL}/content/about`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(aboutData)
        });
        const result = await response.json();
        ui.showToast(result.message);
        if (response.ok) {
            await client.fetchSiteContent();
            client.renderPublicSite();
        }
    } catch (error) {
        ui.showToast(error.message || 'Error al guardar la sección.');
    } finally {
        ui.setButtonLoadingState(btn, false, 'Guardar Cambios');
    }
}

export async function handleAddImage() {
    console.log('¡El botón de añadir imagen fue presionado!');

    const btn = document.getElementById('save-gallery-image-btn');
    const fileInput = document.getElementById('edit-gallery-file');
    const altText = document.getElementById('edit-gallery-alt').value;
    if (fileInput.files.length === 0 || !altText) {
        ui.showToast("Selecciona una imagen y añade una descripción.");
        return;
    }
    ui.setButtonLoadingState(btn, true, 'Subiendo...');
    try {
        // PRIMERO, subimos la imagen al endpoint /upload
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('barber_accessToken')}` },
            body: formData
        });
        const uploadData = await uploadResponse.json();
        if (!uploadData.success) throw new Error('Falló la subida de la imagen.');

        // SEGUNDO, guardamos la referencia en la galería con la URL de Cloudinary
        const response = await fetch(`${API_BASE_URL}/gallery/images`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ url: uploadData.url, altText: altText })
        });
        const result = await response.json();
        ui.showToast(result.message);
        if (response.ok) {
            ui.closeAllModals();
            await client.fetchSiteContent();
            renderAdminGalleryList();
        }
    } catch (error) {
        ui.showToast(error.message || 'Error al añadir la imagen.');
    } finally {
        ui.setButtonLoadingState(btn, false, 'Añadir a la Galería');
    }
}


// =======================================================
// (EL RESTO DE FUNCIONES SE MANTIENEN IGUAL)
// =======================================================

export async function handleSaveLocation() {
    const btn = document.getElementById('save-location-btn');
    ui.setButtonLoadingState(btn, true, 'Guardando...');
    const locationData = {
        address: document.getElementById('edit-location-address').value.replace(/\n/g, '<br>'),
        schedule: document.getElementById('edit-location-schedule').value.replace(/\n/g, '<br>'),
        mapUrl: document.getElementById('edit-location-map').value
    };
    try {
        const response = await fetch(`${API_BASE_URL}/content/location`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(locationData)
        });
        const result = await response.json();
        ui.showToast(result.message);
        if (response.ok) {
            await client.fetchSiteContent();
            client.renderPublicSite();
        }
    } catch (error) {
        ui.showToast('Error de conexión al guardar la ubicación.');
    } finally {
        ui.setButtonLoadingState(btn, false, 'Guardar Cambios');
    }
}

export async function handleSaveService() {
    const serviceId = document.getElementById('edit-service-id').value;
    const isNew = !serviceId;
    const url = isNew ? `${API_BASE_URL}/content/services` : `${API_BASE_URL}/content/services/${serviceId}`;
    const method = isNew ? 'POST' : 'PUT';
    const serviceData = {
        name: document.getElementById('edit-service-name').value,
        description: document.getElementById('edit-service-description').value,
        price: document.getElementById('edit-service-price').value,
        duration: document.getElementById('edit-service-duration').value
    };
    try {
        const response = await fetch(url, {
            method: method,
            headers: getAuthHeaders(),
            body: JSON.stringify(serviceData)
        });
        const result = await response.json();
        ui.showToast(result.message);
        if (response.ok) {
            ui.closeAllModals();
            await client.fetchSiteContent();
            renderAdminServicesList();
        }
    } catch (error) {
        ui.showToast('Error de conexión al guardar el servicio.');
    }
}

export async function handleDeleteService(serviceId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este servicio?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/content/services/${serviceId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const result = await response.json();
        ui.showToast(result.message);
        if (response.ok) {
            await client.fetchSiteContent();
            renderAdminServicesList();
        }
    } catch (error) {
        ui.showToast('Error de conexión al eliminar el servicio.');
    }
}

export function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const preview = document.getElementById('image-preview');
        const previewContainer = document.getElementById('image-preview-container');
        preview.src = URL.createObjectURL(file);
        previewContainer.classList.remove('hidden');
        document.getElementById('save-gallery-image-btn').disabled = false;
    }
}

export async function handleDeleteImage(event) {
    const deleteBtn = event.target.closest('.delete-gallery-btn');
    if (!deleteBtn) return;
    const imageId = deleteBtn.dataset.id;
    if (!confirm('¿Seguro que quieres eliminar esta imagen de la galería?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/gallery/images/${imageId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const result = await response.json();
        ui.showToast(result.message);
        if (response.ok) {
            await client.fetchSiteContent();
            renderAdminGalleryList();
        }
    } catch (error) {
        ui.showToast('Error de conexión al eliminar la imagen.');
    }
}

async function renderScheduleEditor() {
    const container = document.getElementById('schedule-editor-container');
    if (!container) return;
    container.innerHTML = '';
    try {
        const response = await fetch(`${API_BASE_URL}/schedule`);
        const scheduleData = await response.json();
        const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const dayIcons = ["wb_sunny", "work", "work", "work", "work", "work", "weekend"];

        scheduleData.forEach(day => {
            const workingHours = JSON.parse(day.workingHours);
            const isOffClass = day.isDayOff ? 'opacity-50' : '';

            const dayCard = document.createElement('div');
            dayCard.className = 'schedule-day-card';
            dayCard.dataset.day = day.dayOfWeek;

            // Header del día con toggle
            let cardHTML = `
                <div class="schedule-day-header">
                    <div class="schedule-day-info">
                        <span class="material-icons schedule-day-icon">${dayIcons[day.dayOfWeek]}</span>
                        <div>
                            <h4 class="schedule-day-name">${days[day.dayOfWeek]}</h4>
                            <span class="schedule-day-status status-text">${day.isDayOff ? 'Cerrado' : 'Abierto'}</span>
                        </div>
                    </div>
                    <label class="schedule-toggle-switch">
                        <input type="checkbox" class="day-off-checkbox" ${day.isDayOff ? 'checked' : ''}>
                        <span class="schedule-toggle-slider"></span>
                    </label>
                </div>

                <!-- Intervalos de tiempo -->
                <div id="intervals-for-${day.dayOfWeek}" class="schedule-intervals-container ${isOffClass}">`;

            if (workingHours.length > 0) {
                workingHours.forEach((interval, index) => {
                    cardHTML += `
                        <div class="time-interval-row">
                            <div class="time-input-group">
                                <label class="time-label">Desde:</label>
                                <input type="time" value="${interval.start}" class="schedule-time-input start-time" ${day.isDayOff ? 'disabled' : ''}>
                            </div>
                            <span class="time-separator">—</span>
                            <div class="time-input-group">
                                <label class="time-label">Hasta:</label>
                                <input type="time" value="${interval.end}" class="schedule-time-input end-time" ${day.isDayOff ? 'disabled' : ''}>
                            </div>
                            <button class="remove-interval-btn ${index === 0 ? 'invisible' : ''}" aria-label="Eliminar intervalo">
                                <span class="material-icons">close</span>
                            </button>
                        </div>`;
                });
            } else {
                cardHTML += `
                    <div class="time-interval-row">
                        <div class="time-input-group">
                            <label class="time-label">Desde:</label>
                            <input type="time" value="09:00" class="schedule-time-input start-time" disabled>
                        </div>
                        <span class="time-separator">—</span>
                        <div class="time-input-group">
                            <label class="time-label">Hasta:</label>
                            <input type="time" value="18:00" class="schedule-time-input end-time" disabled>
                        </div>
                        <button class="remove-interval-btn invisible" aria-label="Eliminar intervalo">
                            <span class="material-icons">close</span>
                        </button>
                    </div>`;
            }

            cardHTML += `
                </div>

                <!-- Botón agregar bloque -->
                <div class="schedule-add-block-container ${isOffClass}">
                    <button class="add-interval-btn" aria-label="Añadir intervalo">
                        <span class="material-icons">add</span>
                        <span>Agregar bloque</span>
                    </button>
                </div>`;

            dayCard.innerHTML = cardHTML;
            container.appendChild(dayCard);
        });
    } catch (error) {
        container.innerHTML = '<p class="text-red-500">No se pudo cargar el editor de horarios.</p>';
    }
}

async function saveSchedule() {
    const btn = document.getElementById('save-schedule-btn');
    ui.setButtonLoadingState(btn, true, "Guardando...");
    const scheduleToSave = [];
    document.querySelectorAll('#schedule-editor-container > div[data-day]').forEach(row => {
        const dayOfWeek = parseInt(row.dataset.day);
        const isDayOff = row.querySelector('.day-off-checkbox').checked;
        let workingHours = [];
        if (!isDayOff) {
            row.querySelectorAll('.time-interval-row').forEach(intervalRow => {
                const start = intervalRow.querySelector('.start-time').value;
                const end = intervalRow.querySelector('.end-time').value;
                if (start && end) workingHours.push({ start, end });
            });
        }
        scheduleToSave.push({ dayOfWeek, workingHours: JSON.stringify(workingHours), isDayOff });
    });
    try {
        const response = await fetch(`${API_BASE_URL}/schedule`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(scheduleToSave)
        });
        const data = await response.json();
        ui.showToast(data.message);
        if(response.ok) await client.fetchSiteContent();
    } catch (error) {
        ui.showToast("Error de conexión al guardar el horario.");
    } finally {
        ui.setButtonLoadingState(btn, false, "Guardar Horario");
    }
}

async function fetchScheduleOverrides() {
    try {
        const response = await fetch(`${API_BASE_URL}/schedule/overrides`);
        if (!response.ok) throw new Error('No se pudieron cargar los horarios especiales.');
        state.scheduleOverrides = await response.json();
    } catch (error) {
        console.error("Error al obtener excepciones:", error);
        ui.showToast(error.message);
        state.scheduleOverrides = [];
    }
}

function renderOverrideCalendar() {
    const gridEl = document.getElementById('override-calendar-grid');
    const monthYearEl = document.getElementById('override-month-year');
    if (!gridEl || !monthYearEl) return;
    gridEl.innerHTML = '';
    const date = state.currentOverrideDate;
    const month = date.getMonth();
    const year = date.getFullYear();
    monthYearEl.textContent = `${date.toLocaleString('es-ES', { month: 'long' })} ${year}`;
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDayOfMonth; i++) {
        gridEl.innerHTML += '<div class="calendar-day empty"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day cursor-pointer';
        dayCell.textContent = day;
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayCell.dataset.dateKey = dateKey;
        const hasOverride = state.scheduleOverrides.some(o => o.date.startsWith(dateKey));
        if (hasOverride) {
            dayCell.classList.add('border-2', 'border-cyan-500', 'font-bold');
        }
        gridEl.appendChild(dayCell);
    }
}

function openOverrideEditorModal(dateKey) {
    const modal = document.getElementById('override-editor-modal');
    const title = document.getElementById('override-modal-title');
    const container = document.getElementById('override-intervals-container');
    const dayOffCheckbox = document.getElementById('override-day-off-checkbox');
    const addIntervalBtn = document.getElementById('add-override-interval-btn');
    const date = new Date(dateKey + 'T00:00:00Z');
    title.textContent = `Editor de Horario para ${date.toLocaleDateString('es-ES', { dateStyle: 'full', timeZone: 'UTC' })}`;
    modal.dataset.currentDate = dateKey;
    const existingOverride = state.scheduleOverrides.find(o => o.date.startsWith(dateKey));
    let scheduleToEdit;
    if (existingOverride) {
        scheduleToEdit = {
            isDayOff: existingOverride.isDayOff,
            workingHours: JSON.parse(existingOverride.workingHours)
        };
        document.getElementById('delete-override-btn').classList.remove('hidden');
    } else {
        const dayOfWeek = date.getUTCDay();
        const weeklySchedule = state.siteContent.schedule.find(d => d.dayOfWeek === dayOfWeek);
        scheduleToEdit = {
            isDayOff: weeklySchedule.isDayOff,
            workingHours: JSON.parse(weeklySchedule.workingHours)
        };
        document.getElementById('delete-override-btn').classList.add('hidden');
    }
    dayOffCheckbox.checked = scheduleToEdit.isDayOff;
    container.innerHTML = '';
    if (scheduleToEdit.workingHours.length > 0) {
        scheduleToEdit.workingHours.forEach(interval => {
            container.appendChild(createIntervalRow(interval.start, interval.end));
        });
    } else if (!scheduleToEdit.isDayOff) {
        container.appendChild(createIntervalRow());
    }
    const isDayOff = dayOffCheckbox.checked;
    container.classList.toggle('opacity-40', isDayOff);
    addIntervalBtn.classList.toggle('hidden', isDayOff);
    container.querySelectorAll('input, button').forEach(el => el.disabled = isDayOff);
    modal.classList.remove('hidden');
}

function createIntervalRow(start = '09:00', end = '18:00') {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 time-interval-row';
    row.innerHTML = `
        <input type="time" value="${start}" class="schedule-time-input start-time">
        <span class="text-gray-400">-</span>
        <input type="time" value="${end}" class="schedule-time-input end-time">
        <button class="remove-interval-btn p-1 text-red-500 hover:bg-red-900 rounded-full" aria-label="Eliminar intervalo">&times;</button>
    `;
    return row;
}

async function saveOverride() {
    const modal = document.getElementById('override-editor-modal');
    const date = modal.dataset.currentDate;
    const isDayOff = document.getElementById('override-day-off-checkbox').checked;
    const intervals = [];
    if (!isDayOff) {
        document.querySelectorAll('#override-intervals-container .time-interval-row').forEach(row => {
            intervals.push({
                start: row.querySelector('.start-time').value,
                end: row.querySelector('.end-time').value
            });
        });
    }
    try {
        const response = await fetch(`${API_BASE_URL}/schedule/overrides`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                date: date,
                workingHours: JSON.stringify(intervals),
                isDayOff: isDayOff
            })
        });
        const result = await response.json();
        ui.showToast(result.message);
        if (response.ok) {
            ui.closeAllModals();
            await fetchScheduleOverrides();
            renderOverrideCalendar();
        }
    } catch (error) {
        ui.showToast('Error al guardar la excepción.');
    }
}

async function deleteOverride() {
    const date = document.getElementById('override-editor-modal').dataset.currentDate;
    if (!confirm(`¿Seguro que quieres eliminar el horario especial para el ${date}? Se usará el horario semanal por defecto.`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/schedule/overrides/${date}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const result = await response.json();
        ui.showToast(result.message);
        if (response.ok) {
            ui.closeAllModals();
            await fetchScheduleOverrides();
            renderOverrideCalendar();
        }
    } catch (error) {
        ui.showToast('Error al eliminar la excepción.');
    }
}

// archivo: admin.js

// archivo: admin.js

function setupAdminSidebar() {
    const links = document.querySelectorAll('.sidebar-link');
    const sections = document.querySelectorAll('.admin-main-content section');

    // Función que se encarga de mostrar la sección correcta y actualizar el menú
    function showSection(targetId, animate = true) {
        // 1. Actualiza la clase 'active' en los enlaces del menú inmediatamente
        links.forEach(link => {
            const isActive = link.getAttribute('href') === targetId;
            link.classList.toggle('active', isActive);
        });

        // 2. Oculta TODAS las secciones con transición
        sections.forEach(section => {
            if (animate) {
                section.classList.add('section-transitioning-out');
            }
            setTimeout(() => {
                section.style.display = 'none';
                section.classList.remove('section-transitioning-out');
            }, animate ? 150 : 0);
        });

        // 3. Muestra la sección objetivo con transición
        const targetSection = document.querySelector(targetId);
        if (targetSection) {
            setTimeout(() => {
                targetSection.style.display = 'block';
                if (animate) {
                    targetSection.classList.add('section-transitioning-in');
                    // Trigger reflow
                    void targetSection.offsetWidth;
                    requestAnimationFrame(() => {
                        targetSection.classList.remove('section-transitioning-in');
                        targetSection.classList.add('section-visible');
                    });
                }
            }, animate ? 150 : 0);
        }
    }

    // Añadimos un evento de clic a cada enlace del menú lateral
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Prevenimos el salto de página
            const targetId = link.getAttribute('href');

            // No hacer nada si ya está activa
            if (link.classList.contains('active')) return;

            showSection(targetId);
        });
    });

    // Al cargar la página, mostramos la primera sección por defecto (sin animación)
    if (links.length > 0) {
        showSection(links[0].getAttribute('href'), false);
    }
}
// =======================================================
// FUNCIÓN PARA APLICAR PRESETS DE HORARIOS
// =======================================================
function applyQuickSchedulePreset(preset) {
    const container = document.getElementById('schedule-editor-container');
    const dayCards = container.querySelectorAll('.schedule-day-card');

    switch(preset) {
        case 'weekdays': // Lunes a Viernes 9AM-6PM
            dayCards.forEach(card => {
                const dayOfWeek = parseInt(card.dataset.day);
                const isDayOffCheckbox = card.querySelector('.day-off-checkbox');
                const intervals = card.querySelectorAll('.time-interval-row');

                if (dayOfWeek === 0 || dayOfWeek === 6) { // Domingo o Sábado
                    isDayOffCheckbox.checked = true;
                    card.querySelector('.status-text').textContent = 'Cerrado';
                    card.querySelector('.schedule-intervals-container').classList.add('opacity-50');
                    card.querySelector('.schedule-add-block-container').classList.add('opacity-50');
                    intervals.forEach(int => int.querySelectorAll('.schedule-time-input').forEach(inp => inp.disabled = true));
                } else { // Lunes a Viernes
                    isDayOffCheckbox.checked = false;
                    card.querySelector('.status-text').textContent = 'Abierto';
                    card.querySelector('.schedule-intervals-container').classList.remove('opacity-50');
                    card.querySelector('.schedule-add-block-container').classList.remove('opacity-50');
                    if (intervals.length > 0) {
                        intervals[0].querySelector('.start-time').value = '09:00';
                        intervals[0].querySelector('.end-time').value = '18:00';
                        intervals[0].querySelectorAll('.schedule-time-input').forEach(inp => inp.disabled = false);
                    }
                }
            });
            break;

        case 'everyday': // Todos los días 10AM-8PM
            dayCards.forEach(card => {
                const isDayOffCheckbox = card.querySelector('.day-off-checkbox');
                const intervals = card.querySelectorAll('.time-interval-row');

                isDayOffCheckbox.checked = false;
                card.querySelector('.status-text').textContent = 'Abierto';
                card.querySelector('.schedule-intervals-container').classList.remove('opacity-50');
                card.querySelector('.schedule-add-block-container').classList.remove('opacity-50');
                if (intervals.length > 0) {
                    intervals[0].querySelector('.start-time').value = '10:00';
                    intervals[0].querySelector('.end-time').value = '20:00';
                    intervals[0].querySelectorAll('.schedule-time-input').forEach(inp => inp.disabled = false);
                }
            });
            break;

        case 'weekends-off': // Cerrar fines de semana
            dayCards.forEach(card => {
                const dayOfWeek = parseInt(card.dataset.day);
                const isDayOffCheckbox = card.querySelector('.day-off-checkbox');
                const intervals = card.querySelectorAll('.time-interval-row');

                if (dayOfWeek === 0 || dayOfWeek === 6) { // Domingo o Sábado
                    isDayOffCheckbox.checked = true;
                    card.querySelector('.status-text').textContent = 'Cerrado';
                    card.querySelector('.schedule-intervals-container').classList.add('opacity-50');
                    card.querySelector('.schedule-add-block-container').classList.add('opacity-50');
                    intervals.forEach(int => int.querySelectorAll('.schedule-time-input').forEach(inp => inp.disabled = true));
                }
            });
            break;
    }

    ui.showToast('Horario preset aplicado. No olvides guardar los cambios.');
}

// =======================================================
// SISTEMA DE DETECCIÓN DE CAMBIOS NO GUARDADOS
// =======================================================

const unsavedChanges = {
    forms: new Map(), // Mapea formularios a sus valores originales
    hasChanges: false
};

/**
 * Inicializa el rastreo de cambios para un formulario
 * @param {string} formId - ID del contenedor del formulario
 * @param {Array<string>} fieldIds - IDs de los campos a rastrear
 */
function trackFormChanges(formId, fieldIds) {
    const originalValues = {};

    fieldIds.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            originalValues[fieldId] = field.type === 'checkbox' ? field.checked : field.value;

            // Agregar listener de cambio
            field.addEventListener('input', () => checkForChanges(formId));
            field.addEventListener('change', () => checkForChanges(formId));
        }
    });

    unsavedChanges.forms.set(formId, { fieldIds, originalValues, hasChanges: false });
}

/**
 * Verifica si hay cambios en un formulario
 */
function checkForChanges(formId) {
    const formData = unsavedChanges.forms.get(formId);
    if (!formData) return;

    let hasChanges = false;

    formData.fieldIds.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            const currentValue = field.type === 'checkbox' ? field.checked : field.value;
            const originalValue = formData.originalValues[fieldId];
            if (currentValue !== originalValue) {
                hasChanges = true;
            }
        }
    });

    formData.hasChanges = hasChanges;
    unsavedChanges.forms.set(formId, formData);

    updateUnsavedIndicator(formId, hasChanges);
    updateGlobalUnsavedState();
}

/**
 * Actualiza el indicador visual de cambios no guardados
 */
function updateUnsavedIndicator(formId, hasChanges) {
    const saveBtn = document.querySelector(`[data-form="${formId}"]`) ||
                    document.getElementById(`save-${formId}-btn`);

    if (saveBtn) {
        if (hasChanges) {
            saveBtn.classList.add('has-changes');
            // Agregar badge si no existe
            if (!saveBtn.querySelector('.unsaved-badge')) {
                const badge = document.createElement('span');
                badge.className = 'unsaved-badge';
                badge.title = 'Hay cambios sin guardar';
                saveBtn.appendChild(badge);
            }
        } else {
            saveBtn.classList.remove('has-changes');
            saveBtn.querySelector('.unsaved-badge')?.remove();
        }
    }

    // Actualizar indicador en la pestaña si existe
    const tabId = getTabIdForForm(formId);
    if (tabId) {
        const tab = document.querySelector(`[data-tab="${tabId}"]`);
        if (tab) {
            if (hasChanges) {
                tab.classList.add('has-unsaved-changes');
            } else {
                tab.classList.remove('has-unsaved-changes');
            }
        }
    }
}

/**
 * Obtiene el ID de pestaña para un formulario
 */
function getTabIdForForm(formId) {
    const formToTab = {
        'business': 'admin-config',
        'palette': 'admin-config',
        'texts': 'admin-content',
        'location': 'admin-content',
        'schedule': 'admin-schedule'
    };
    return formToTab[formId];
}

/**
 * Actualiza el estado global de cambios no guardados
 */
function updateGlobalUnsavedState() {
    let globalHasChanges = false;

    unsavedChanges.forms.forEach(formData => {
        if (formData.hasChanges) {
            globalHasChanges = true;
        }
    });

    unsavedChanges.hasChanges = globalHasChanges;

    // Mostrar/ocultar banner global
    const banner = document.getElementById('unsaved-changes-banner');
    if (banner) {
        if (globalHasChanges) {
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
    }
}

/**
 * Marca un formulario como guardado (resetea los valores originales)
 */
function markFormAsSaved(formId) {
    const formData = unsavedChanges.forms.get(formId);
    if (!formData) return;

    const newOriginalValues = {};
    formData.fieldIds.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            newOriginalValues[fieldId] = field.type === 'checkbox' ? field.checked : field.value;
        }
    });

    formData.originalValues = newOriginalValues;
    formData.hasChanges = false;
    unsavedChanges.forms.set(formId, formData);

    updateUnsavedIndicator(formId, false);
    updateGlobalUnsavedState();
}

/**
 * Inicializa el sistema de detección de cambios
 */
function initUnsavedChangesTracking() {
    // Rastrear formulario de negocio
    trackFormChanges('business', [
        'edit-business-name', 'edit-business-logo', 'edit-business-phone',
        'edit-business-whatsapp', 'edit-social-instagram', 'edit-social-facebook', 'edit-social-tiktok'
    ]);

    // Rastrear paleta de colores
    trackFormChanges('palette', [
        'color-accent', 'color-background', 'color-text-main', 'color-text-subtle'
    ]);

    // Rastrear textos
    trackFormChanges('texts', ['edit-hero-title', 'edit-hero-subtitle']);

    // Rastrear ubicación
    trackFormChanges('location', ['edit-location-address', 'edit-location-schedule', 'edit-location-map']);

    // Agregar advertencia antes de salir de la página
    window.addEventListener('beforeunload', (e) => {
        if (unsavedChanges.hasChanges) {
            e.preventDefault();
            e.returnValue = '¿Seguro que quieres salir? Tienes cambios sin guardar.';
            return e.returnValue;
        }
    });

    // Crear banner de cambios no guardados si no existe
    if (!document.getElementById('unsaved-changes-banner')) {
        const banner = document.createElement('div');
        banner.id = 'unsaved-changes-banner';
        banner.className = 'unsaved-changes-banner hidden';
        banner.innerHTML = `
            <span class="material-icons">warning</span>
            <span>Tienes cambios sin guardar</span>
        `;
        ui.adminMainView?.insertAdjacentElement('afterbegin', banner);
    }
}

// =======================================================
// EVENT LISTENERS DEL PANEL DE ADMIN
// =======================================================
function setupAdminEventListeners() {
    // Inicializar sistema de cambios no guardados
    initUnsavedChangesTracking();
    // --- GESTIÓN DE CONFIGURACIÓN DEL NEGOCIO ---
    document.getElementById('save-business-btn')?.addEventListener('click', handleSaveBusiness);

    // --- GESTIÓN DE PALETA DE COLORES ---
    document.getElementById('save-palette-btn')?.addEventListener('click', handleSavePalette);
    document.getElementById('theme-presets-container')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.theme-preset-btn');
        if (btn) {
            const themeKey = btn.dataset.theme;
            const theme = THEME_PRESETS[themeKey];
            if (theme) {
                document.getElementById('color-accent').value = theme.colors.accent;
                document.getElementById('color-background').value = theme.colors.background;
                document.getElementById('color-text-main').value = theme.colors.textMain;
                document.getElementById('color-text-subtle').value = theme.colors.textSubtle;
                ui.applyPalette(theme.colors);
            }
        }
    });

    // --- GESTIÓN DE CONTENIDO ---
    document.getElementById('save-texts-btn')?.addEventListener('click', handleSaveTexts);
    document.getElementById('save-hero-bg-btn')?.addEventListener('click', handleSaveHeroBackground);
    document.getElementById('save-about-section-btn')?.addEventListener('click', handleSaveAboutSection);
    document.getElementById('save-location-btn')?.addEventListener('click', handleSaveLocation);
    document.getElementById('save-service-btn')?.addEventListener('click', handleSaveService);
    document.getElementById('save-gallery-image-btn')?.addEventListener('click', handleAddImage);
    document.getElementById('edit-gallery-file')?.addEventListener('change', handleFileSelect);
    document.getElementById('admin-gallery-list')?.addEventListener('click', handleDeleteImage);
    
    // --- GESTOR DE HORARIO SEMANAL ---
    const scheduleContainer = document.getElementById('schedule-editor-container');
    scheduleContainer?.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-interval-btn');
        if (addBtn) {
            const dayCard = addBtn.closest('.schedule-day-card');
            const intervalsDiv = dayCard.querySelector('[id^="intervals-for-"]');
            const newInterval = document.createElement('div');
            newInterval.className = 'time-interval-row';
            newInterval.innerHTML = `
                <div class="time-input-group">
                    <label class="time-label">Desde:</label>
                    <input type="time" value="09:00" class="schedule-time-input start-time">
                </div>
                <span class="time-separator">—</span>
                <div class="time-input-group">
                    <label class="time-label">Hasta:</label>
                    <input type="time" value="18:00" class="schedule-time-input end-time">
                </div>
                <button class="remove-interval-btn" aria-label="Eliminar intervalo">
                    <span class="material-icons">close</span>
                </button>`;
            intervalsDiv.appendChild(newInterval);
        }
        const removeBtn = e.target.closest('.remove-interval-btn');
        if (removeBtn) {
            removeBtn.closest('.time-interval-row').remove();
        }
    });
    scheduleContainer?.addEventListener('change', (e) => {
        if (e.target.classList.contains('day-off-checkbox')) {
            const dayCard = e.target.closest('.schedule-day-card');
            const isOff = e.target.checked;
            dayCard.querySelector('.schedule-intervals-container').classList.toggle('opacity-50', isOff);
            dayCard.querySelector('.schedule-add-block-container').classList.toggle('opacity-50', isOff);
            dayCard.querySelector('.status-text').textContent = isOff ? 'Cerrado' : 'Abierto';
            dayCard.querySelectorAll('.schedule-time-input').forEach(input => input.disabled = isOff);
            dayCard.querySelectorAll('.add-interval-btn').forEach(btn => btn.disabled = isOff);
        }
    });
    document.getElementById('save-schedule-btn')?.addEventListener('click', saveSchedule);

    // --- BOTÓN DE ATAJOS RÁPIDOS ---
    document.getElementById('quick-schedule-btn')?.addEventListener('click', () => {
        const menu = document.getElementById('quick-schedule-menu');
        menu.classList.toggle('hidden');
    });

    // --- PRESETS DE HORARIOS RÁPIDOS ---
    document.querySelectorAll('.quick-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            applyQuickSchedulePreset(preset);
            document.getElementById('quick-schedule-menu').classList.add('hidden');
        });
    });

    // --- GESTOR DE EXCEPCIONES DE HORARIO ---
    document.getElementById('override-prev-month-btn')?.addEventListener('click', () => {
        state.currentOverrideDate.setMonth(state.currentOverrideDate.getMonth() - 1);
        renderOverrideCalendar();
    });
    document.getElementById('override-next-month-btn')?.addEventListener('click', () => {
        state.currentOverrideDate.setMonth(state.currentOverrideDate.getMonth() + 1);
        renderOverrideCalendar();
    });
    document.getElementById('override-calendar-grid')?.addEventListener('click', (e) => {
        const dayCell = e.target.closest('.calendar-day:not(.empty)');
        if (dayCell) openOverrideEditorModal(dayCell.dataset.dateKey);
    });
    document.getElementById('add-override-interval-btn')?.addEventListener('click', () => {
        document.getElementById('override-intervals-container').appendChild(createIntervalRow());
    });
    document.getElementById('override-intervals-container')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-interval-btn')) {
            e.target.closest('.time-interval-row').remove();
        }
    });
    document.getElementById('override-day-off-checkbox')?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const container = document.getElementById('override-intervals-container');
        const addBtn = document.getElementById('add-override-interval-btn');
        container.classList.toggle('opacity-40', isChecked);
        addBtn.classList.toggle('hidden', isChecked);
        container.querySelectorAll('input, button').forEach(el => el.disabled = isChecked);
    });
    document.getElementById('save-override-btn')?.addEventListener('click', saveOverride);
    document.getElementById('delete-override-btn')?.addEventListener('click', deleteOverride);

    // --- DASHBOARD DE VENTAS ---
    document.getElementById('sales-period-today')?.addEventListener('click', () => updateSalesDashboard('today'));
    document.getElementById('sales-period-week')?.addEventListener('click', () => updateSalesDashboard('week'));
    document.getElementById('sales-period-month')?.addEventListener('click', () => updateSalesDashboard('month'));

    // Renderizar dashboard de ventas al cargar
    renderSalesDashboard();
}

// =======================================================
// DASHBOARD DE VENTAS - FUNCIONES
// =======================================================

let currentSalesPeriod = 'today';
let salesLoading = false;

function renderSalesDashboard() {
    updateSalesDashboard('today');
}

/**
 * Actualiza el dashboard de ventas obteniendo datos del servidor
 * @param {string} period - 'today', 'week', 'month'
 */
async function updateSalesDashboard(period) {
    if (salesLoading) return;
    salesLoading = true;
    currentSalesPeriod = period;

    // Actualizar botones activos
    document.querySelectorAll('.sales-period-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`sales-period-${period}`)?.classList.add('active');

    // Mostrar estado de carga
    showSalesLoading(true);

    try {
        // Obtener token de autenticación
        const token = sessionStorage.getItem('accessToken');
        if (!token) {
            throw new Error('No autenticado');
        }

        // Llamar al endpoint de ventas
        const response = await fetch(`${API_BASE_URL}/sales/stats?period=${period}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error al obtener estadísticas');
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error desconocido');
        }

        // Actualizar UI con datos del servidor
        updateSalesUI(data);

    } catch (error) {
        console.error('Error al cargar dashboard de ventas:', error);
        // Fallback: usar método local
        updateSalesDashboardLocal(period);
    } finally {
        salesLoading = false;
        showSalesLoading(false);
    }
}

/**
 * Muestra/oculta indicador de carga en el dashboard
 */
function showSalesLoading(show) {
    const container = document.getElementById('sales-metrics-container');
    if (!container) return;

    if (show) {
        container.classList.add('loading');
    } else {
        container.classList.remove('loading');
    }
}

/**
 * Actualiza la UI del dashboard con datos del servidor
 * @param {Object} data - Datos de ventas del servidor
 */
function updateSalesUI(data) {
    const { metrics, servicesBreakdown, recentTransactions } = data;

    // Métricas principales
    document.getElementById('sales-total-earnings').textContent = `$${metrics.totalEarnings.toFixed(2)}`;
    document.getElementById('sales-completed-appointments').textContent = metrics.completedAppointments;
    document.getElementById('sales-total-appointments').textContent = metrics.totalAppointments;
    document.getElementById('sales-top-service').textContent = metrics.topService?.name || 'Sin datos';
    document.getElementById('sales-top-service-count').textContent = metrics.topService
        ? `${metrics.topService.count} reservas`
        : '0 reservas';
    document.getElementById('sales-total-clients').textContent = metrics.uniqueClients;
    document.getElementById('sales-avg-ticket').textContent = `$${metrics.avgTicket.toFixed(0)}`;
    document.getElementById('sales-cancelled-count').textContent = metrics.cancelledAppointments;
    document.getElementById('sales-pending-count').textContent = metrics.pendingAppointments;

    // Actualizar indicadores de cambio
    updateChangeIndicator('sales-earnings-change', metrics.earningsChange);
    updateChangeIndicator('sales-appointments-change', metrics.appointmentsChange);

    // Renderizar desglose por servicio
    renderServicesBreakdown(servicesBreakdown);

    // Renderizar últimas transacciones
    renderRecentTransactionsFromServer(recentTransactions);
}

/**
 * Actualiza un indicador de cambio porcentual
 */
function updateChangeIndicator(elementId, change) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const isPositive = change >= 0;
    el.className = `metric-change ${isPositive ? 'positive' : 'negative'}`;
    el.innerHTML = `
        <span class="material-icons text-xs">${isPositive ? 'trending_up' : 'trending_down'}</span>
        ${isPositive ? '+' : ''}${change.toFixed(1)}%
    `;
}

/**
 * Renderiza transacciones desde datos del servidor
 */
function renderRecentTransactionsFromServer(transactions) {
    const container = document.getElementById('sales-recent-transactions');
    if (!container) return;

    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <span class="material-icons text-4xl text-gray-600 mb-2">receipt_long</span>
                <p class="text-gray-500">No hay transacciones en este período</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(tx => {
        const isCancelled = tx.status === 'CANCELLED';
        const txDate = new Date(tx.date);

        return `
            <div class="transaction-item ${isCancelled ? 'cancelled' : ''}">
                <div class="transaction-info">
                    <span class="transaction-service">${escapeHtml(tx.serviceName)}</span>
                    <span class="transaction-client">${escapeHtml(tx.userName)}</span>
                    <span class="transaction-time">${txDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} - ${tx.time}</span>
                </div>
                <span class="transaction-amount ${isCancelled ? 'cancelled' : ''}">
                    ${isCancelled ? 'Cancelada' : '$' + tx.servicePrice.toFixed(2)}
                </span>
            </div>
        `;
    }).join('');
}

/**
 * Fallback: Actualizar dashboard con datos locales (si falla el servidor)
 */
function updateSalesDashboardLocal(period) {
    const now = new Date();
    let startDate, endDate;

    switch(period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'week':
            const dayOfWeek = now.getDay();
            startDate = new Date(now);
            startDate.setDate(now.getDate() - dayOfWeek);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
    }

    // Obtener todas las citas del período
    const allAppointmentsFlat = Object.values(state.allAppointments).flat();
    const periodAppointments = allAppointmentsFlat.filter(app => {
        const appDate = new Date(app.dateKey + 'T' + app.time);
        return appDate >= startDate && appDate <= endDate;
    });

    // Calcular métricas
    const completedAppointments = periodAppointments.filter(app =>
        app.status !== 'CANCELLED' && new Date(app.dateKey + 'T' + app.time) <= now
    );
    const cancelledAppointments = periodAppointments.filter(app => app.status === 'CANCELLED');
    const pendingAppointments = periodAppointments.filter(app =>
        app.status !== 'CANCELLED' && new Date(app.dateKey + 'T' + app.time) > now
    );

    // Calcular ganancias totales
    let totalEarnings = 0;
    const serviceBreakdown = {};
    const uniqueClients = new Set();

    completedAppointments.forEach(app => {
        const service = state.siteContent?.services?.find(s => s.id === app.serviceId);
        const price = service?.price || 0;
        totalEarnings += price;

        if (!serviceBreakdown[app.serviceId]) {
            serviceBreakdown[app.serviceId] = {
                name: app.serviceName || service?.name || 'Servicio',
                count: 0,
                total: 0,
                price: price
            };
        }
        serviceBreakdown[app.serviceId].count++;
        serviceBreakdown[app.serviceId].total += price;
        uniqueClients.add(app.userEmail);
    });

    const avgTicket = completedAppointments.length > 0
        ? totalEarnings / completedAppointments.length
        : 0;

    const sortedServices = Object.values(serviceBreakdown).sort((a, b) => b.count - a.count);
    const topService = sortedServices[0];

    // Actualizar UI
    document.getElementById('sales-total-earnings').textContent = `$${totalEarnings.toFixed(2)}`;
    document.getElementById('sales-completed-appointments').textContent = completedAppointments.length;
    document.getElementById('sales-total-appointments').textContent = periodAppointments.length;
    document.getElementById('sales-top-service').textContent = topService?.name || 'Sin datos';
    document.getElementById('sales-top-service-count').textContent = topService ? `${topService.count} reservas` : '0 reservas';
    document.getElementById('sales-total-clients').textContent = uniqueClients.size;
    document.getElementById('sales-avg-ticket').textContent = `$${avgTicket.toFixed(0)}`;
    document.getElementById('sales-cancelled-count').textContent = cancelledAppointments.length;
    document.getElementById('sales-pending-count').textContent = pendingAppointments.length;

    renderServicesBreakdown(sortedServices);
    renderRecentTransactions(periodAppointments.slice().reverse().slice(0, 10));
}

function renderServicesBreakdown(services) {
    const container = document.getElementById('sales-services-breakdown');
    if (!container) return;

    if (services.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <span class="material-icons text-4xl text-gray-600 mb-2">analytics</span>
                <p class="text-gray-500">No hay datos para este período</p>
            </div>
        `;
        return;
    }

    container.innerHTML = services.map((service, index) => `
        <div class="breakdown-item">
            <div class="breakdown-service-info">
                <span class="breakdown-rank ${index < 3 ? 'rank-' + (index + 1) : ''}">${index + 1}</span>
                <div>
                    <span class="breakdown-service-name">${escapeHtml(service.name)}</span>
                    <span class="breakdown-service-count">${service.count} servicio${service.count !== 1 ? 's' : ''}</span>
                </div>
            </div>
            <span class="breakdown-service-total">$${service.total.toFixed(2)}</span>
        </div>
    `).join('');
}

function renderRecentTransactions(appointments) {
    const container = document.getElementById('sales-recent-transactions');
    if (!container) return;

    if (appointments.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <span class="material-icons text-4xl text-gray-600 mb-2">receipt_long</span>
                <p class="text-gray-500">No hay transacciones en este período</p>
            </div>
        `;
        return;
    }

    container.innerHTML = appointments.map(app => {
        const service = state.siteContent?.services?.find(s => s.id === app.serviceId);
        const price = service?.price || 0;
        const isCancelled = app.status === 'CANCELLED';
        const appDate = new Date(app.dateKey + 'T' + app.time);

        return `
            <div class="transaction-item ${isCancelled ? 'cancelled' : ''}">
                <div class="transaction-info">
                    <span class="transaction-service">${escapeHtml(app.serviceName || service?.name || 'Servicio')}</span>
                    <span class="transaction-client">${escapeHtml(app.userName || 'Cliente')}</span>
                    <span class="transaction-time">${appDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} - ${app.time}</span>
                </div>
                <span class="transaction-amount ${isCancelled ? 'cancelled' : ''}">
                    ${isCancelled ? 'Cancelada' : '$' + price.toFixed(2)}
                </span>
            </div>
        `;
    }).join('');
}

// =======================================================
// GESTIÓN DE BARBEROS
// =======================================================

let allBarbers = [];

/**
 * Carga y renderiza la lista de barberos
 */
export async function renderBarbersList() {
    const container = document.getElementById('barbers-list');
    if (!container) return;

    container.innerHTML = `
        <div class="col-span-full loading-state">
            <div class="loading-spinner"></div>
            <p class="loading-text">Cargando barberos...</p>
        </div>
    `;

    try {
        const response = await authFetch(`${API_BASE_URL}/barbers/admin/all`);
        if (!response.ok) throw new Error('Error al cargar barberos');

        const data = await response.json();
        allBarbers = data.barbers || [];

        if (allBarbers.length === 0) {
            container.innerHTML = `
                <div class="col-span-full empty-state">
                    <span class="material-icons text-4xl text-gray-600 mb-2">person_off</span>
                    <p class="text-gray-500">No hay barberos registrados</p>
                    <p class="text-sm text-gray-600 mt-2">Agrega un barbero para comenzar</p>
                </div>
            `;
            return;
        }

        container.innerHTML = allBarbers.map(barber => {
            const specialties = JSON.parse(barber.specialties || '[]');
            const appointmentCount = barber._count?.appointments || 0;

            return `
                <div class="barber-admin-card ${!barber.isActive ? 'inactive' : ''}" data-barber-id="${barber.id}">
                    <div class="barber-admin-header">
                        ${barber.photo ?
                            `<img src="${escapeHtml(barber.photo)}" alt="${escapeHtml(barber.name)}" class="barber-admin-photo">` :
                            `<div class="barber-admin-photo-placeholder"><span class="material-icons">person</span></div>`
                        }
                        <div class="barber-admin-info">
                            <h4 class="barber-admin-name">${escapeHtml(barber.name)}</h4>
                            <span class="barber-admin-status ${barber.isActive ? 'active' : 'inactive'}">
                                ${barber.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                    </div>
                    <div class="barber-admin-stats">
                        <div class="barber-stat">
                            <span class="material-icons text-sm">content_cut</span>
                            <span>${specialties.length} servicios</span>
                        </div>
                        <div class="barber-stat">
                            <span class="material-icons text-sm">event</span>
                            <span>${appointmentCount} citas</span>
                        </div>
                    </div>
                    <div class="barber-admin-actions">
                        <button class="barber-action-btn edit" data-action="edit" title="Editar">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="barber-action-btn schedule" data-action="schedule" title="Horario">
                            <span class="material-icons">schedule</span>
                        </button>
                        <button class="barber-action-btn delete" data-action="delete" title="Eliminar">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Agregar event listeners
        container.querySelectorAll('.barber-admin-card').forEach(card => {
            card.querySelectorAll('.barber-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const barberId = card.dataset.barberId;
                    const barber = allBarbers.find(b => b.id === barberId);

                    if (action === 'edit') openBarberEditor(barber);
                    else if (action === 'schedule') openBarberScheduleEditor(barber);
                    else if (action === 'delete') deleteBarber(barber);
                });
            });
        });

    } catch (error) {
        console.error('Error al cargar barberos:', error);
        container.innerHTML = `
            <div class="col-span-full error-state">
                <span class="material-icons text-4xl text-red-400 mb-2">error</span>
                <p class="text-red-300">Error al cargar barberos</p>
                <button type="button" class="btn-secondary mt-4 retry-barbers-btn">
                    <span class="material-icons">refresh</span> Reintentar
                </button>
            </div>
        `;
        // Agregar event listener para reintentar
        container.querySelector('.retry-barbers-btn')?.addEventListener('click', renderBarbersList);
    }
}

/**
 * Abre el modal de edición de barbero
 */
function openBarberEditor(barber = null) {
    const modal = document.getElementById('barber-editor-modal');
    const title = document.getElementById('barber-editor-title');
    const form = document.getElementById('barber-editor-form');
    const idInput = document.getElementById('barber-editor-id');
    const nameInput = document.getElementById('barber-editor-name');
    const photoInput = document.getElementById('barber-editor-photo');
    const activeInput = document.getElementById('barber-editor-active');
    const specialtiesContainer = document.getElementById('barber-specialties-checkboxes');

    if (!modal || !form) return;

    // Configurar título
    title.textContent = barber ? 'Editar Barbero' : 'Nuevo Barbero';

    // Llenar formulario
    idInput.value = barber?.id || '';
    nameInput.value = barber?.name || '';
    photoInput.value = barber?.photo || '';
    activeInput.checked = barber?.isActive !== false;

    // Cargar checkboxes de servicios
    const barberSpecialties = barber ? JSON.parse(barber.specialties || '[]') : [];
    const services = state.siteContent?.services || [];

    specialtiesContainer.innerHTML = services.map(service => `
        <label class="flex items-center gap-2 p-2 rounded hover:bg-gray-700 cursor-pointer">
            <input type="checkbox" name="specialty" value="${service.id}"
                ${barberSpecialties.includes(service.id) ? 'checked' : ''}
                class="form-checkbox">
            <span>${escapeHtml(service.name)}</span>
        </label>
    `).join('');

    modal.classList.remove('hidden');
}

/**
 * Guarda un barbero (crear o actualizar)
 */
async function saveBarber(formData) {
    const id = formData.id;
    const url = id ? `${API_BASE_URL}/barbers/${id}` : `${API_BASE_URL}/barbers`;
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await authFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar barbero');
        }

        ui.showToast(id ? 'Barbero actualizado' : 'Barbero creado');
        document.getElementById('barber-editor-modal')?.classList.add('hidden');
        renderBarbersList();

    } catch (error) {
        console.error('Error al guardar barbero:', error);
        ui.showToast(error.message || 'Error al guardar barbero', 'error');
    }
}

/**
 * Elimina un barbero
 */
async function deleteBarber(barber) {
    if (!confirm(`¿Estás seguro de eliminar a ${barber.name}? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const response = await authFetch(`${API_BASE_URL}/barbers/${barber.id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al eliminar barbero');
        }

        ui.showToast('Barbero eliminado');
        renderBarbersList();

    } catch (error) {
        console.error('Error al eliminar barbero:', error);
        ui.showToast(error.message || 'Error al eliminar barbero', 'error');
    }
}

/**
 * Abre el editor de horario del barbero
 */
function openBarberScheduleEditor(barber) {
    const modal = document.getElementById('barber-schedule-modal');
    const title = document.getElementById('barber-schedule-title');
    const editor = document.getElementById('barber-schedule-editor');

    if (!modal || !editor) return;

    title.textContent = `Horario de ${barber.name}`;
    modal.dataset.barberId = barber.id;

    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const schedules = barber.schedules || [];

    editor.innerHTML = days.map((day, index) => {
        const daySchedule = schedules.find(s => s.dayOfWeek === index);
        const isDayOff = daySchedule?.isDayOff || false;
        let hours = [];
        try {
            hours = JSON.parse(daySchedule?.workingHours || '[]');
        } catch (e) { }
        const startTime = hours[0]?.start || '09:00';
        const endTime = hours[0]?.end || '18:00';

        return `
            <div class="schedule-day-row" data-day="${index}">
                <div class="schedule-day-name">${day}</div>
                <div class="schedule-day-controls">
                    <label class="flex items-center gap-2">
                        <input type="checkbox" class="day-off-checkbox" ${isDayOff ? 'checked' : ''}>
                        <span class="text-sm">Día libre</span>
                    </label>
                    <div class="schedule-time-inputs ${isDayOff ? 'hidden' : ''}">
                        <input type="time" class="time-start" value="${startTime}">
                        <span class="text-gray-500">a</span>
                        <input type="time" class="time-end" value="${endTime}">
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Event listeners para checkboxes de día libre
    editor.querySelectorAll('.day-off-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const row = checkbox.closest('.schedule-day-row');
            const timeInputs = row.querySelector('.schedule-time-inputs');
            if (checkbox.checked) {
                timeInputs.classList.add('hidden');
            } else {
                timeInputs.classList.remove('hidden');
            }
        });
    });

    modal.classList.remove('hidden');
}

/**
 * Guarda el horario de un barbero
 */
async function saveBarberSchedule() {
    const modal = document.getElementById('barber-schedule-modal');
    const barberId = modal?.dataset.barberId;
    if (!barberId) return;

    const editor = document.getElementById('barber-schedule-editor');
    const schedules = [];

    editor.querySelectorAll('.schedule-day-row').forEach(row => {
        const dayOfWeek = parseInt(row.dataset.day);
        const isDayOff = row.querySelector('.day-off-checkbox').checked;
        const startTime = row.querySelector('.time-start')?.value || '09:00';
        const endTime = row.querySelector('.time-end')?.value || '18:00';

        schedules.push({
            dayOfWeek,
            isDayOff,
            workingHours: isDayOff ? '[]' : JSON.stringify([{ start: startTime, end: endTime }])
        });
    });

    try {
        const response = await authFetch(`${API_BASE_URL}/barbers/${barberId}/schedule`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schedules })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar horario');
        }

        ui.showToast('Horario actualizado');
        modal.classList.add('hidden');
        renderBarbersList();

    } catch (error) {
        console.error('Error al guardar horario:', error);
        ui.showToast(error.message || 'Error al guardar horario', 'error');
    }
}

/**
 * Inicializa los event listeners de gestión de barberos
 */
export function setupBarbersEventListeners() {
    // Botón agregar barbero
    document.getElementById('add-barber-btn')?.addEventListener('click', () => {
        openBarberEditor(null);
    });

    // Formulario de barbero
    document.getElementById('barber-editor-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {
            id: document.getElementById('barber-editor-id').value || undefined,
            name: document.getElementById('barber-editor-name').value,
            photo: document.getElementById('barber-editor-photo').value,
            isActive: document.getElementById('barber-editor-active').checked,
            specialties: Array.from(document.querySelectorAll('input[name="specialty"]:checked')).map(cb => cb.value)
        };
        saveBarber(formData);
    });

    // Cancelar editor de barbero
    document.getElementById('barber-editor-cancel')?.addEventListener('click', () => {
        document.getElementById('barber-editor-modal')?.classList.add('hidden');
    });

    // Guardar horario de barbero
    document.getElementById('barber-schedule-save')?.addEventListener('click', saveBarberSchedule);

    // Cancelar horario de barbero
    document.getElementById('barber-schedule-cancel')?.addEventListener('click', () => {
        document.getElementById('barber-schedule-modal')?.classList.add('hidden');
    });

    // Botones de cerrar (X) en modales de barberos
    document.querySelectorAll('#barber-editor-modal .close-modal-btn, #barber-schedule-modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay')?.classList.add('hidden');
        });
    });
}

// ============================================
// GESTIÓN DE TESTIMONIOS
// ============================================

let allTestimonials = [];

/**
 * Renderiza la lista de testimonios en el panel admin
 */
export async function renderTestimonialsList() {
    const container = document.getElementById('testimonials-list');
    if (!container) return;

    container.innerHTML = '<div class="col-span-full text-center py-8"><span class="material-icons animate-spin">refresh</span> Cargando...</div>';

    try {
        const response = await authFetch(`${API_BASE_URL}/content/testimonials/all`);
        if (!response.ok) throw new Error('Error al cargar testimonios');

        const data = await response.json();
        const testimonials = data.testimonials || [];

        if (testimonials.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <span class="material-icons text-6xl text-gray-600 mb-4">format_quote</span>
                    <p class="text-gray-400">No hay testimonios registrados</p>
                    <p class="text-sm text-gray-500 mt-2">Haz clic en "Agregar Testimonio" para crear uno</p>
                </div>
            `;
            return;
        }

        container.innerHTML = testimonials.map(testimonial => `
            <div class="admin-card testimonial-card ${!testimonial.isActive ? 'opacity-50' : ''}" data-testimonial-id="${testimonial.id}">
                <div class="admin-card-body">
                    <div class="flex items-start gap-4">
                        <img src="${testimonial.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(testimonial.name) + '&background=d4a574&color=1a1a1a'}"
                             alt="${testimonial.name}"
                             class="w-12 h-12 rounded-full object-cover">
                        <div class="flex-1">
                            <div class="flex items-center justify-between">
                                <h4 class="font-semibold text-white">${testimonial.name}</h4>
                                ${testimonial.verified ? '<span class="text-green-400 text-xs flex items-center gap-1"><span class="material-icons text-sm">verified</span> Verificado</span>' : ''}
                            </div>
                            <div class="flex items-center gap-1 mt-1">
                                ${Array(5).fill(0).map((_, i) => `<span class="material-icons text-sm ${i < testimonial.rating ? 'text-yellow-500' : 'text-gray-600'}">star</span>`).join('')}
                            </div>
                        </div>
                    </div>
                    <p class="text-gray-300 text-sm mt-4 line-clamp-3">"${testimonial.text}"</p>
                    ${!testimonial.isActive ? '<span class="inline-block mt-3 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">Inactivo</span>' : ''}
                </div>
                <div class="admin-card-footer flex gap-2">
                    <button class="testimonial-action-btn btn-secondary flex-1 flex items-center justify-center gap-1" data-action="edit">
                        <span class="material-icons text-sm">edit</span>
                        Editar
                    </button>
                    <button class="testimonial-action-btn btn-danger flex items-center justify-center gap-1 px-3" data-action="delete">
                        <span class="material-icons text-sm">delete</span>
                    </button>
                </div>
            </div>
        `).join('');

        // Attach event listeners to action buttons
        allTestimonials = testimonials;
        container.querySelectorAll('.testimonial-card').forEach(card => {
            card.querySelectorAll('.testimonial-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const testimonialId = card.dataset.testimonialId;
                    const testimonial = allTestimonials.find(t => t.id === testimonialId);

                    if (action === 'edit') openTestimonialEditor(testimonialId);
                    else if (action === 'delete') deleteTestimonial(testimonialId);
                });
            });
        });

    } catch (error) {
        console.error('Error al cargar testimonios:', error);
        container.innerHTML = `
            <div class="col-span-full text-center py-8 text-red-400">
                <span class="material-icons text-4xl mb-2">error</span>
                <p>Error al cargar testimonios</p>
            </div>
        `;
    }
}

/**
 * Abre el editor de testimonio
 */
export async function openTestimonialEditor(testimonialId = null) {
    const modal = document.getElementById('testimonial-editor-modal');
    const title = document.getElementById('testimonial-editor-title');
    const form = document.getElementById('testimonial-editor-form');

    if (!modal || !form) return;

    // Reset form
    form.reset();
    document.getElementById('testimonial-editor-id').value = '';
    document.getElementById('testimonial-editor-rating').value = '5';
    updateStarRating(5);

    if (testimonialId) {
        title.textContent = 'Editar Testimonio';
        try {
            const response = await authFetch(`${API_BASE_URL}/content/testimonials/all`);
            if (!response.ok) throw new Error('Error al cargar testimonio');

            const data = await response.json();
            const testimonial = data.testimonials?.find(t => t.id === testimonialId);

            if (testimonial) {
                document.getElementById('testimonial-editor-id').value = testimonial.id;
                document.getElementById('testimonial-editor-name').value = testimonial.name;
                document.getElementById('testimonial-editor-text').value = testimonial.text;
                document.getElementById('testimonial-editor-rating').value = testimonial.rating;
                document.getElementById('testimonial-editor-avatar').value = testimonial.avatar || '';
                document.getElementById('testimonial-editor-verified').checked = testimonial.verified;
                document.getElementById('testimonial-editor-active').checked = testimonial.isActive;
                updateStarRating(testimonial.rating);
            }
        } catch (error) {
            console.error('Error al cargar testimonio:', error);
            ui.showToast('Error al cargar testimonio', 'error');
            return;
        }
    } else {
        title.textContent = 'Nuevo Testimonio';
    }

    modal.classList.remove('hidden');
}

/**
 * Actualiza la visualización de las estrellas de rating
 */
function updateStarRating(rating) {
    const stars = document.querySelectorAll('#testimonial-rating-stars .star-btn');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.remove('text-gray-400');
            star.classList.add('text-yellow-500');
        } else {
            star.classList.remove('text-yellow-500');
            star.classList.add('text-gray-400');
        }
    });
}

/**
 * Guarda un testimonio (crear o actualizar)
 */
async function saveTestimonial(formData) {
    const isEdit = !!formData.id;
    const url = isEdit
        ? `${API_BASE_URL}/content/testimonials/${formData.id}`
        : `${API_BASE_URL}/content/testimonials`;

    try {
        const response = await authFetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: formData.name,
                text: formData.text,
                rating: parseInt(formData.rating),
                avatar: formData.avatar || '',
                verified: formData.verified,
                isActive: formData.isActive
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar testimonio');
        }

        ui.showToast(isEdit ? 'Testimonio actualizado' : 'Testimonio creado');
        document.getElementById('testimonial-editor-modal')?.classList.add('hidden');
        renderTestimonialsList();

    } catch (error) {
        console.error('Error al guardar testimonio:', error);
        ui.showToast(error.message || 'Error al guardar testimonio', 'error');
    }
}

/**
 * Elimina un testimonio
 */
export async function deleteTestimonial(testimonialId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este testimonio?')) return;

    try {
        const response = await authFetch(`${API_BASE_URL}/content/testimonials/${testimonialId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al eliminar testimonio');
        }

        ui.showToast('Testimonio eliminado');
        renderTestimonialsList();

    } catch (error) {
        console.error('Error al eliminar testimonio:', error);
        ui.showToast(error.message || 'Error al eliminar testimonio', 'error');
    }
}

/**
 * Inicializa los event listeners de gestión de testimonios
 */
export function setupTestimonialsEventListeners() {
    // Botón agregar testimonio
    document.getElementById('add-testimonial-btn')?.addEventListener('click', () => {
        openTestimonialEditor(null);
    });

    // Formulario de testimonio
    document.getElementById('testimonial-editor-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {
            id: document.getElementById('testimonial-editor-id').value || undefined,
            name: document.getElementById('testimonial-editor-name').value,
            text: document.getElementById('testimonial-editor-text').value,
            rating: document.getElementById('testimonial-editor-rating').value,
            avatar: document.getElementById('testimonial-editor-avatar').value,
            verified: document.getElementById('testimonial-editor-verified').checked,
            isActive: document.getElementById('testimonial-editor-active').checked
        };
        saveTestimonial(formData);
    });

    // Cancelar editor de testimonio
    document.getElementById('testimonial-editor-cancel')?.addEventListener('click', () => {
        document.getElementById('testimonial-editor-modal')?.classList.add('hidden');
    });

    // Rating stars click handler
    document.querySelectorAll('#testimonial-rating-stars .star-btn').forEach(star => {
        star.addEventListener('click', (e) => {
            e.preventDefault();
            const rating = parseInt(star.dataset.rating);
            document.getElementById('testimonial-editor-rating').value = rating;
            updateStarRating(rating);
        });
    });

    // Close modal buttons
    document.querySelectorAll('#testimonial-editor-modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('testimonial-editor-modal')?.classList.add('hidden');
        });
    });
}