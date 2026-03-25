// --- client.js (Versión Final y Corregida) ---
import * as ui from './ui.js';
import { API_BASE_URL, fetchWithRetry, handleResponseError, ERROR_MESSAGES } from './config.js';
import { state } from './main.js';
import { escapeHtml, sanitizeHtml, sanitizeUrl } from './js/sanitizer.js';
import { authFetch, isAdmin } from './auth.js';

// =======================================================
// FUNCIONES DE OBTENCIÓN DE DATOS (FETCHING)
// =======================================================

/**
 * Obtiene todas las citas del servidor y las guarda en el estado global.
 * Solo los administradores pueden ver todas las citas.
 * Los clientes verán un objeto vacío (usan available-slots para el calendario).
 * @param {boolean} [showLoading=false] - Si mostrar indicador de carga
 */
export async function fetchAllAppointments(showLoading = false) {
    const calendarGrid = ui.userCalendarGrid;

    try {
        if (showLoading && calendarGrid) {
            ui.showCalendarSkeleton(calendarGrid);
        }

        // Solo los admins pueden ver todas las citas
        if (!isAdmin()) {
            state.allAppointments = {};
            return;
        }

        // Usar authFetch para enviar el token de autenticación
        const response = await authFetch(`${API_BASE_URL}/appointments`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
            },
        });

        if (!response.ok) {
            // Si falla la autenticación, usar objeto vacío
            if (response.status === 401 || response.status === 403) {
                state.allAppointments = {};
                return;
            }
            throw new Error('No se pudieron cargar las citas desde el servidor.');
        }

        state.allAppointments = await response.json();

        // Re-renderizar calendario si estaba mostrando skeleton
        if (showLoading && calendarGrid) {
            renderClientCalendar();
        }
    } catch (error) {
        console.error("Error en fetchAllAppointments:", error);
        // No mostrar error si simplemente no tiene permisos
        if (!isAdmin()) {
            state.allAppointments = {};
            return;
        }
        ui.showToast("No se pudo sincronizar con el calendario del servidor.", 'error');
        throw error;
    }
}

/**
 * Obtiene citas paginadas del servidor para el panel admin
 * @param {Object} options - Opciones de paginación
 * @param {number} options.page - Número de página (1-based)
 * @param {number} options.limit - Citas por página
 * @param {string} options.status - Filtrar por estado ('CONFIRMED', 'CANCELLED', 'all')
 * @param {boolean} options.upcoming - Solo citas futuras
 * @returns {Promise<Object>} - Citas paginadas con metadata
 */
export async function fetchPaginatedAppointments({ page = 1, limit = 10, status = 'all', upcoming = true } = {}) {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            status,
            upcoming: upcoming.toString()
        });

        // Usar authFetch para enviar el token de autenticación (solo admin)
        const response = await authFetch(`${API_BASE_URL}/appointments?${params}`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
            },
        });

        if (!response.ok) {
            throw new Error('No se pudieron cargar las citas.');
        }

        return await response.json();
    } catch (error) {
        console.error("Error en fetchPaginatedAppointments:", error);
        ui.showToast("No se pudo cargar las citas.", 'error');
        throw error;
    }
}

/**
 * Obtiene todo el contenido público del sitio, lo guarda en el estado global,
 * y aplica la paleta de colores.
 */
export async function fetchSiteContent() {
    try {
        const response = await fetch(`${API_BASE_URL}/content/public`);
        if (!response.ok) throw new Error('No se pudo cargar el contenido del sitio.');
        state.siteContent = await response.json();

        if (state.siteContent.palette) {
            ui.applyPalette(state.siteContent.palette);
        }

    } catch (error) {
        console.error("Error en fetchSiteContent:", error);
        ui.showToast("Error al cargar el contenido principal del sitio.");
        throw error;
    }
}


// =======================================================
// FUNCIONES DE RENDERIZADO (VISTA PÚBLICA Y CLIENTE)
// =======================================================

/**
 * Renderiza todas las secciones públicas del sitio utilizando los datos del estado global.
 */
export function renderPublicSite() {
    if (!state.siteContent) {
        document.getElementById('client-main-view').innerHTML = '<p class="text-center text-red-500 text-2xl py-20">Error crítico: El contenido del sitio no está disponible.</p>';
        return;
    }

    const { hero, about, location, services, gallery, business, social } = state.siteContent;

    // === RENDERIZAR INFORMACIÓN DEL NEGOCIO ===
    if (business) {
        // Nombre del negocio en el header y título de la página
        const siteTitle = document.querySelector('.site-title');
        if (siteTitle) siteTitle.textContent = escapeHtml(business.name);
        document.title = escapeHtml(business.name);

        // Logo del negocio (si existe)
        const logoContainer = document.getElementById('business-logo');
        if (logoContainer && business.logo) {
            const safeLogoUrl = sanitizeUrl(business.logo);
            if (safeLogoUrl) {
                logoContainer.innerHTML = `<img src="${safeLogoUrl}" alt="${escapeHtml(business.name)}" class="h-10 w-auto">`;
                logoContainer.classList.remove('hidden');
            }
        }

        // Botón flotante de WhatsApp
        const whatsappBtn = document.getElementById('whatsapp-float-btn');
        if (whatsappBtn) {
            if (business.whatsapp) {
                const cleanNumber = business.whatsapp.replace(/\D/g, '');
                whatsappBtn.href = `https://wa.me/${cleanNumber}`;
                whatsappBtn.classList.remove('hidden');
            } else {
                whatsappBtn.classList.add('hidden');
            }
        }

        // Teléfono de contacto
        const phoneLink = document.getElementById('business-phone-link');
        if (phoneLink) {
            if (business.phone) {
                const cleanPhone = business.phone.replace(/\D/g, '');
                phoneLink.href = `tel:${cleanPhone}`;
                phoneLink.textContent = business.phone;
                phoneLink.parentElement?.classList.remove('hidden');
            } else {
                phoneLink.parentElement?.classList.add('hidden');
            }
        }

        // === ACTUALIZAR CINTILLO SUPERIOR ===
        updateTopBar(business, social, location);
    }

    // === RENDERIZAR REDES SOCIALES ===
    if (social) {
        const socialContainer = document.getElementById('social-links-container');
        if (socialContainer) {
            let hasSocial = false;

            const instagramLink = document.getElementById('social-instagram');
            if (instagramLink) {
                if (social.instagram) {
                    instagramLink.href = social.instagram.startsWith('http') ? social.instagram : `https://instagram.com/${social.instagram}`;
                    instagramLink.classList.remove('hidden');
                    hasSocial = true;
                } else {
                    instagramLink.classList.add('hidden');
                }
            }

            const facebookLink = document.getElementById('social-facebook');
            if (facebookLink) {
                if (social.facebook) {
                    facebookLink.href = social.facebook.startsWith('http') ? social.facebook : `https://facebook.com/${social.facebook}`;
                    facebookLink.classList.remove('hidden');
                    hasSocial = true;
                } else {
                    facebookLink.classList.add('hidden');
                }
            }

            const tiktokLink = document.getElementById('social-tiktok');
            if (tiktokLink) {
                if (social.tiktok) {
                    tiktokLink.href = social.tiktok.startsWith('http') ? social.tiktok : `https://tiktok.com/@${social.tiktok}`;
                    tiktokLink.classList.remove('hidden');
                    hasSocial = true;
                } else {
                    tiktokLink.classList.add('hidden');
                }
            }

            socialContainer.classList.toggle('hidden', !hasSocial);
        }
    }

    // === RENDERIZAR HERO ===
    const heroSection = document.getElementById('inicio');
    if (heroSection && hero) {
        heroSection.style.backgroundImage = (hero.backgroundType === 'IMAGE') ? `url('${hero.backgroundValue}')` : '';
        heroSection.style.backgroundColor = (hero.backgroundType === 'COLOR') ? hero.backgroundValue : 'transparent';
        ui.welcomeMessage.textContent = hero.title;
        ui.heroSubtitle.textContent = hero.subtitle;
    }

    // === RENDERIZAR ABOUT ===
    if (about) {
        const aboutImg = document.getElementById('about-section-image');
        const safeAboutImgUrl = sanitizeUrl(about.image);
        if (aboutImg && safeAboutImgUrl) aboutImg.src = safeAboutImgUrl;
        ui.aboutTextContainer.innerHTML = sanitizeHtml(about.text);
    }

    // === RENDERIZAR UBICACIÓN ===
    if (location) {
        document.getElementById('location-address').innerHTML = sanitizeHtml(location.address);
        document.getElementById('location-schedule').innerHTML = sanitizeHtml(location.schedule);
        const mapUrl = sanitizeUrl(location.mapUrl);
        if (mapUrl) document.getElementById('location-map').src = mapUrl;
    }

    // === RENDERIZAR SERVICIOS ===
    ui.servicesListContainer.innerHTML = '';
    services.forEach(service => {
        const serviceLink = document.createElement('a');
        serviceLink.href = '#agendar';
        serviceLink.className = "bg-[#1a1a1a] p-8 rounded-lg shadow-lg transform hover:-translate-y-2 transition-transform duration-300 block";
        serviceLink.innerHTML = `
            <h3 class="font-display text-2xl text-accent mb-3">${escapeHtml(service.name)}</h3>
            <p class="text-subtle mb-4">${escapeHtml(service.description)}</p>
            <div class="flex justify-between items-center">
                <span class="text-main inline-flex items-center"><span class="material-icons text-sm mr-1">schedule</span>${escapeHtml(String(service.duration))} min</span>
                <span class="text-xl font-semibold text-main">$${escapeHtml(String(service.price))}</span>
            </div>`;
        ui.servicesListContainer.appendChild(serviceLink);
    });

    // === RENDERIZAR GALERÍA ===
    ui.galleryContainer.innerHTML = '';
    if (gallery && gallery.length > 0) {
        gallery.forEach((image, index) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.setAttribute('tabindex', '0');
            item.setAttribute('role', 'button');
            item.setAttribute('aria-label', `Ver imagen: ${escapeHtml(image.altText)}`);
            const safeUrl = sanitizeUrl(image.url) || '';
            const safeAlt = escapeHtml(image.altText);
            item.innerHTML = `
                <img src="${safeUrl}" alt="${safeAlt}">
                <div class="gallery-overlay"><p>${safeAlt}</p></div>
            `;
            ui.galleryContainer.appendChild(item);
        });
    } else {
        ui.galleryContainer.innerHTML = '<p class="text-subtle col-span-full text-center">Próximamente, los mejores momentos de nuestro estudio.</p>';
    }

    // === RENDERIZAR FOOTER CON NOMBRE DEL NEGOCIO ===
    const footerText = document.getElementById('footer-business-name');
    if (footerText && business) {
        footerText.textContent = escapeHtml(business.name);
    }

    // === RENDERIZAR TESTIMONIOS ===
    renderTestimonials();
}

/**
 * Actualiza el cintillo superior con los datos del negocio
 */
function updateTopBar(business, social, location) {
    // Teléfono
    const topBarPhone = document.getElementById('top-bar-phone');
    if (topBarPhone) {
        if (business?.phone) {
            const cleanPhone = business.phone.replace(/\D/g, '');
            topBarPhone.href = `tel:${cleanPhone}`;
            topBarPhone.querySelector('.top-bar-text').textContent = business.phone;
            topBarPhone.style.display = 'flex';
        } else {
            topBarPhone.style.display = 'none';
        }
    }

    // Horario (extraer del location si existe)
    const topBarSchedule = document.getElementById('top-bar-schedule');
    if (topBarSchedule && location?.schedule) {
        // Limpiar el HTML y obtener solo el texto relevante
        const scheduleText = location.schedule.replace(/<br\s*\/?>/gi, ' | ').replace(/<[^>]*>/g, '');
        topBarSchedule.querySelector('.top-bar-text').textContent = scheduleText;
    }

    // WhatsApp
    const topBarWhatsapp = document.getElementById('top-bar-whatsapp');
    if (topBarWhatsapp) {
        if (business?.whatsapp) {
            const cleanNumber = business.whatsapp.replace(/\D/g, '');
            topBarWhatsapp.href = `https://wa.me/${cleanNumber}`;
            topBarWhatsapp.style.display = 'flex';
        } else {
            topBarWhatsapp.style.display = 'none';
        }
    }

    // Instagram
    const topBarInstagram = document.getElementById('top-bar-instagram');
    if (topBarInstagram) {
        if (social?.instagram) {
            topBarInstagram.href = social.instagram;
            topBarInstagram.style.display = 'flex';
        } else {
            topBarInstagram.style.display = 'none';
        }
    }

    // Facebook
    const topBarFacebook = document.getElementById('top-bar-facebook');
    if (topBarFacebook) {
        if (social?.facebook) {
            topBarFacebook.href = social.facebook;
            topBarFacebook.style.display = 'flex';
        } else {
            topBarFacebook.style.display = 'none';
        }
    }

    // TikTok
    const topBarTiktok = document.getElementById('top-bar-tiktok');
    if (topBarTiktok) {
        if (social?.tiktok) {
            topBarTiktok.href = social.tiktok;
            topBarTiktok.style.display = 'flex';
        } else {
            topBarTiktok.style.display = 'none';
        }
    }
}

/**
 * Verifica si el sitio necesita configuración inicial (wizard)
 */
export async function checkSetupStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/content/setup-status`);
        if (!response.ok) return true; // Si hay error, asumimos que está configurado
        const data = await response.json();
        return data.isConfigured;
    } catch (error) {
        console.error('Error verificando estado de configuración:', error);
        return true;
    }
}

/**
 * Renderiza el calendario para la vista del cliente.
 */
export function renderClientCalendar() {
    if (ui.userCalendarGrid) {
        ui.renderCalendar(ui.userCalendarGrid, ui.userMonthYearEl, state.currentClientDate, state.allAppointments);
    }
}

/**
 * MODIFICADO: Renderiza el portal del usuario sin adjuntar listeners.
 * La lógica ahora se maneja por delegación de eventos en main.js.
 */
// archivo: client.js

export async function renderUserPortal() {
    const upcomingList = document.getElementById('upcoming-appointments-list');
    const pastList = document.getElementById('past-appointments-list');
    const upcomingCount = document.getElementById('upcoming-count');
    const pastCount = document.getElementById('past-count');
    const portalGreeting = document.getElementById('user-portal-greeting');

    upcomingList.innerHTML = '';
    pastList.innerHTML = '';

    if (!state.currentUser || state.currentUser.role !== 'CLIENT') {
        upcomingList.innerHTML = '<p class="text-subtle text-center py-8">Inicia sesión para ver tus citas.</p>';
        if (upcomingCount) upcomingCount.textContent = '0';
        if (pastCount) pastCount.textContent = '0';
        return;
    }

    // Actualizar saludo personalizado
    if (portalGreeting) {
        portalGreeting.textContent = `Hola ${state.currentUser.name.split(' ')[0]}, gestiona tus citas aquí`;
    }

    try {
        const allAppointmentsFlat = Object.values(state.allAppointments).flat();
        const userAppointments = allAppointmentsFlat.filter(app => app.userEmail === state.currentUser.email);
        const now = new Date();

        // Solo contar citas CONFIRMADAS para próximas
        const upcoming = userAppointments.filter(app =>
            new Date(app.dateKey + 'T' + app.time) > now && app.status !== 'CANCELLED'
        );
        const past = userAppointments.filter(app => new Date(app.dateKey + 'T' + app.time) <= now);

        // Actualizar contadores
        if (upcomingCount) upcomingCount.textContent = upcoming.length.toString();
        if (pastCount) pastCount.textContent = past.length.toString();

        if (upcoming.length === 0) {
            upcomingList.innerHTML = `
                <div class="text-center py-8">
                    <span class="material-icons text-4xl text-gray-600 mb-2">event_available</span>
                    <p class="text-subtle">No tienes citas próximas</p>
                    <a href="#agendar" class="inline-block mt-4 text-accent hover:underline">Agendar una cita</a>
                </div>`;
        } else {
            upcoming.sort((a, b) => new Date(a.dateKey + 'T' + a.time) - new Date(b.dateKey + 'T' + b.time)).forEach(app => {
                const card = document.createElement('div');

                const isCancelled = app.status === 'CANCELLED';
                card.className = `client-appointment-card ${isCancelled ? 'cancelled-appointment' : ''}`;
                card.dataset.appointmentId = app.id;
                card.dataset.dateKey = app.dateKey;

                const appDate = new Date(app.dateKey + 'T' + app.time);

                // Calcular días restantes
                const daysUntil = Math.ceil((appDate - now) / (1000 * 60 * 60 * 24));
                const daysText = daysUntil === 0 ? 'Hoy' : daysUntil === 1 ? 'Mañana' : `En ${daysUntil} días`;

                const actionButtonHTML = isCancelled
                    ? '<div class="mt-3"><span class="inline-flex items-center gap-1 text-red-500 font-semibold"><span class="material-icons text-sm">cancel</span>CANCELADA</span></div>'
                    : `<div class="appointment-actions">
                           <button class="cancel-appointment-btn flex items-center gap-1">
                               <span class="material-icons text-sm">close</span>
                               Cancelar Cita
                           </button>
                       </div>
                       <div class="appointment-confirm-cancel hidden">
                           <p>¿Estás seguro de cancelar?</p>
                           <button class="confirm-cancel-btn">Sí, cancelar</button>
                           <button class="abort-cancel-btn">No</button>
                       </div>`;

                card.innerHTML = `
                    <div class="appointment-details">
                        <div class="flex items-start justify-between mb-3">
                            <h4 class="font-display text-xl text-accent">${escapeHtml(app.serviceName)}</h4>
                            <span class="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">${daysText}</span>
                        </div>
                        <div class="details text-subtle space-y-2">
                            <p class="flex items-center gap-2">
                                <span class="material-icons text-sm text-accent">event</span>
                                <span class="text-main">${escapeHtml(appDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}</span>
                            </p>
                            <p class="flex items-center gap-2">
                                <span class="material-icons text-sm text-accent">schedule</span>
                                <span class="text-main">${escapeHtml(appDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))} hrs</span>
                            </p>
                        </div>
                    </div>
                    ${actionButtonHTML}`;

                upcomingList.appendChild(card);
            });
        }

        if (past.length === 0) {
            pastList.innerHTML = '<p class="text-subtle text-center py-4">Sin historial de citas</p>';
        } else {
            past.sort((a, b) => new Date(b.dateKey + 'T' + b.time) - new Date(a.dateKey + 'T' + a.time))
                .slice(0, 10) // Mostrar solo las últimas 10
                .forEach(app => {
                    const item = document.createElement('div');
                    const isCancelled = app.status === 'CANCELLED';
                    item.className = `flex justify-between items-center bg-[#2d2d2d] p-3 rounded-lg ${isCancelled ? 'opacity-50' : ''}`;
                    const appDate = new Date(app.dateKey + 'T' + app.time);
                    item.innerHTML = `
                        <div class="flex items-center gap-3">
                            <span class="material-icons text-sm ${isCancelled ? 'text-red-500' : 'text-green-500'}">${isCancelled ? 'cancel' : 'check_circle'}</span>
                            <div>
                                <span class="text-subtle text-sm">${escapeHtml(appDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }))}</span>
                                <span class="font-semibold text-main ml-2">${escapeHtml(app.serviceName)}</span>
                            </div>
                        </div>
                        ${isCancelled ? '<span class="text-red-400 text-xs">Cancelada</span>' : '<span class="text-green-400 text-xs">Completada</span>'}
                    `;
                    pastList.appendChild(item);
                });

            // Si hay más de 10, mostrar mensaje
            if (past.length > 10) {
                const moreItem = document.createElement('p');
                moreItem.className = 'text-subtle text-center text-sm mt-2';
                moreItem.textContent = `+${past.length - 10} citas anteriores`;
                pastList.appendChild(moreItem);
            }
        }
    } catch (error) {
        console.error("Error al renderizar portal de usuario:", error);
        upcomingList.innerHTML = '<p class="text-red-500 text-center py-4">No se pudieron cargar tus citas.</p>';
    }
}

// =======================================================
// LÓGICA DE CITAS DEL CLIENTE
// =======================================================

/**
 * SOLUCIÓN DEFINITIVA: Maneja la cancelación de citas actualizando el estado local.
 */
// archivo: client.js

export async function handleCancelAppointment(appointmentId, cardElement) {
    try {
        const token = sessionStorage.getItem('barber_accessToken');
        const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}?cancelledBy=client`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();
        
        if (response.ok) {
            ui.showToast("Cita cancelada con éxito.");

            // --- LÓGICA CORREGIDA ---
            // 1. Buscamos la cita en nuestro estado local
            const dateKey = cardElement.dataset.dateKey;
            const appointment = state.allAppointments[dateKey]?.find(app => app.id === appointmentId);

            // 2. Si la encontramos, actualizamos su estado a 'CANCELLED'
            if (appointment) {
                appointment.status = 'CANCELLED';
            }
            
            // 3. Volvemos a renderizar el portal y el calendario para que reflejen el cambio
            renderUserPortal();
            renderClientCalendar();
            
        } else {
            ui.showToast(result.message || "No se pudo cancelar la cita.");
            cardElement.classList.remove('confirming-cancel');
        }
    } catch (error) {
        console.error("Error al cancelar cita:", error);
        ui.showToast("Error de conexión al cancelar la cita.");
        cardElement.classList.remove('confirming-cancel');
    }
}

// =======================================================
// LÓGICA DE RESERVA DE CITAS (BOOKING)
// =======================================================

export function openBookingModal(dateKey) {
    state.activeBooking = { dateKey, barberId: null, serviceId: null, time: null };
    const date = new Date(dateKey + 'T00:00:00Z');

    ui.modalTitle.textContent = `Reserva para el ${date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}`;

    ui.bookingStep1.classList.remove('hidden');
    ui.bookingStep2.classList.add('hidden');
    const bookingStep3 = document.getElementById('booking-step-3');
    if (bookingStep3) bookingStep3.classList.add('hidden');
    ui.clientLoginView.classList.remove('hidden');
    ui.clientRegisterView.classList.add('hidden');

    // Ocultar secciones que dependen de selección previa
    const serviceSection = document.getElementById('service-section');
    const timeSection = document.getElementById('time-section');
    if (serviceSection) serviceSection.classList.add('hidden');
    if (timeSection) timeSection.classList.add('hidden');

    ui.bookingNextBtn.textContent = state.currentUser ? "Confirmar Cita" : "Siguiente";

    // Cargar barberos disponibles para la fecha
    renderBarbersForBookingModal(dateKey);
    updateConfirmBtnState();

    // Clear any previous form errors
    const inputs = ui.bookingModal.querySelectorAll('input');
    inputs.forEach(input => {
        input.classList.remove('input-error');
        const errorMsg = input.parentNode.querySelector('.field-error-message');
        if (errorMsg) errorMsg.remove();
    });

    ui.bookingModal.classList.remove('hidden');
}

/**
 * Renderiza la selección de barberos disponibles para una fecha
 */
async function renderBarbersForBookingModal(dateKey) {
    const barberContainer = document.getElementById('barber-selection-container');
    if (!barberContainer) return;

    barberContainer.innerHTML = `
        <div class="loading-slots-container">
            <div class="loading-spinner-slots"></div>
            <p class="text-subtle mt-3">Cargando barberos disponibles...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/barbers/available?date=${dateKey}`);
        if (!response.ok) throw new Error('Error al cargar barberos');

        const data = await response.json();
        const barbers = data.barbers || [];

        if (barbers.length === 0) {
            barberContainer.innerHTML = `
                <div class="text-center py-4">
                    <span class="material-icons text-3xl text-gray-500 mb-2">person_off</span>
                    <p class="text-gray-400">No hay barberos disponibles para este día</p>
                </div>
            `;
            return;
        }

        barberContainer.innerHTML = '';
        barbers.forEach(barber => {
            const specialties = JSON.parse(barber.specialties || '[]');
            const card = document.createElement('div');
            card.className = 'barber-card';
            card.dataset.barberId = barber.id;
            card.innerHTML = `
                <div class="barber-check">
                    <span class="material-icons">check</span>
                </div>
                ${barber.photo ?
                    `<img src="${escapeHtml(barber.photo)}" alt="${escapeHtml(barber.name)}" class="barber-photo">` :
                    `<div class="barber-photo-placeholder"><span class="material-icons">person</span></div>`
                }
                <span class="barber-name">${escapeHtml(barber.name)}</span>
                ${specialties.length > 0 ?
                    `<span class="barber-specialties">${specialties.length} servicios</span>` :
                    ''
                }
            `;

            card.addEventListener('click', () => {
                // Deseleccionar otros
                barberContainer.querySelectorAll('.barber-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.activeBooking.barberId = barber.id;
                state.activeBooking.barberName = barber.name;
                state.activeBooking.barberPhoto = barber.photo;
                state.activeBooking.barberSpecialties = specialties;

                // Mostrar sección de servicios
                const serviceSection = document.getElementById('service-section');
                if (serviceSection) serviceSection.classList.remove('hidden');

                // Cargar servicios (filtrados por especialidades del barbero si las tiene)
                renderServicesForBookingModal(specialties);

                // Resetear selección de servicio y hora
                state.activeBooking.serviceId = null;
                state.activeBooking.time = null;
                const timeSection = document.getElementById('time-section');
                if (timeSection) timeSection.classList.add('hidden');
                updateConfirmBtnState();
            });

            barberContainer.appendChild(card);
        });

    } catch (error) {
        console.error('Error al cargar barberos:', error);
        barberContainer.innerHTML = `
            <div class="text-center py-4">
                <span class="material-icons text-3xl text-red-400 mb-2">error</span>
                <p class="text-red-300">Error al cargar barberos</p>
                <button type="button" class="retry-slots-btn mt-2" onclick="window.retryLoadBarbers && window.retryLoadBarbers()">
                    <span class="material-icons">refresh</span>
                    Reintentar
                </button>
            </div>
        `;
        window.retryLoadBarbers = () => renderBarbersForBookingModal(dateKey);
    }
}

/**
 * Renderiza los servicios disponibles (opcionalmente filtrados por especialidades del barbero)
 */
function renderServicesForBookingModal(barberSpecialties = []) {
    ui.serviceSelectionContainer.innerHTML = '';
    if (!state.siteContent?.services || state.siteContent.services.length === 0) {
        ui.serviceSelectionContainer.innerHTML = "<p class='text-yellow-400'>No hay servicios disponibles para reservar.</p>";
        return;
    }

    // Filtrar servicios por especialidades del barbero si las tiene
    let availableServices = state.siteContent.services;
    if (barberSpecialties.length > 0) {
        availableServices = state.siteContent.services.filter(s => barberSpecialties.includes(s.id));
        // Si el barbero no tiene servicios específicos, mostrar todos
        if (availableServices.length === 0) {
            availableServices = state.siteContent.services;
        }
    }

    availableServices.forEach(service => {
        const label = document.createElement('label');
        label.className = "block p-4 rounded-lg bg-gray-800 border-2 border-gray-700 cursor-pointer transition-all";
        label.innerHTML = `
            <input type="radio" name="service" value="${escapeHtml(service.id)}" class="hidden">
            <div class="flex justify-between items-center">
                <span class="font-semibold text-main">${escapeHtml(service.name)}</span>
                <span class="text-accent font-bold">$${escapeHtml(String(service.price))}</span>
            </div>`;
        label.addEventListener('click', () => {
            ui.serviceSelectionContainer.querySelectorAll('label').forEach(l => l.classList.remove('selected'));
            label.classList.add('selected');
            state.activeBooking.serviceId = service.id;

            // Mostrar sección de horarios
            const timeSection = document.getElementById('time-section');
            if (timeSection) timeSection.classList.remove('hidden');

            // Cargar horarios disponibles para el barbero seleccionado
            renderTimeSlotsForModal(state.activeBooking.dateKey);
            updateConfirmBtnState();
        });
        ui.serviceSelectionContainer.appendChild(label);
    });
}

async function renderTimeSlotsForModal(dateKey) {
    // Mostrar estado de carga con spinner
    ui.timeSlotsContainer.innerHTML = `
        <div class="col-span-full loading-slots-container">
            <div class="loading-spinner-slots"></div>
            <p class="text-subtle mt-3">Cargando disponibilidad...</p>
        </div>
    `;

    try {
        // Construir URL con barberId si está seleccionado
        let url = `${API_BASE_URL}/appointments/available-slots?date=${dateKey}`;
        if (state.activeBooking?.barberId) {
            url += `&barberId=${state.activeBooking.barberId}`;
        }

        const response = await fetchWithRetry(
            url,
            { method: 'GET' },
            2, // reintentos
            10000 // timeout 10s
        );

        if (!response.ok) {
            const errorInfo = await handleResponseError(response);
            throw errorInfo;
        }

        const availableHours = await response.json();
        ui.timeSlotsContainer.innerHTML = '';

        if (availableHours.length === 0) {
            // Mostrar mensaje y buscar días alternativos
            await showNoSlotsWithAlternatives(dateKey);
            return;
        }

        availableHours.forEach(hour => {
            const slot = document.createElement('div');
            slot.textContent = hour;
            slot.className = 'time-slot available';
            slot.addEventListener('click', () => {
                ui.timeSlotsContainer.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
                slot.classList.add('selected');
                state.activeBooking.time = hour;
                updateConfirmBtnState();
            });
            ui.timeSlotsContainer.appendChild(slot);
        });

    } catch (error) {
        console.error("Error al obtener los horarios disponibles:", error);

        // Mensaje específico según el tipo de error
        let errorMessage = 'No se pudo cargar la disponibilidad.';
        let errorIcon = 'error';

        if (error.type === 'TIMEOUT') {
            errorMessage = 'La conexión tardó demasiado. Verifica tu internet e intenta de nuevo.';
            errorIcon = 'timer_off';
        } else if (error.type === 'NETWORK') {
            errorMessage = 'Sin conexión a internet. Verifica tu red e intenta de nuevo.';
            errorIcon = 'wifi_off';
        } else if (error.status === 404) {
            errorMessage = 'Este día no está disponible para reservas.';
            errorIcon = 'event_busy';
        } else if (error.status >= 500) {
            errorMessage = 'Error del servidor. Intenta más tarde.';
            errorIcon = 'cloud_off';
        }

        ui.timeSlotsContainer.innerHTML = `
            <div class="col-span-full error-slots-container">
                <span class="material-icons text-4xl text-red-400 mb-2">${errorIcon}</span>
                <p class="text-red-300 mb-3">${errorMessage}</p>
                <button type="button" class="retry-slots-btn" onclick="window.retryLoadSlots && window.retryLoadSlots()">
                    <span class="material-icons">refresh</span>
                    Reintentar
                </button>
            </div>
        `;

        // Función de reintento global
        window.retryLoadSlots = () => renderTimeSlotsForModal(dateKey);
    }
}

/**
 * Muestra mensaje de no disponibilidad con días alternativos sugeridos
 * @param {string} dateKey - La fecha sin disponibilidad
 */
async function showNoSlotsWithAlternatives(dateKey) {
    // Mostrar mensaje inicial
    ui.timeSlotsContainer.innerHTML = `
        <div class="col-span-full no-slots-container">
            <div class="no-slots-message">
                <span class="material-icons text-4xl text-gray-500 mb-2">event_busy</span>
                <p class="text-gray-400 mb-4">No hay horarios disponibles para este día</p>
                <p class="text-sm text-gray-500">Buscando días cercanos con disponibilidad...</p>
            </div>
        </div>
    `;

    try {
        // Buscar días alternativos
        const response = await fetch(`${API_BASE_URL}/appointments/next-available?startDate=${dateKey}&maxResults=3`);

        if (!response.ok) {
            throw new Error('No se pudieron cargar alternativas');
        }

        const data = await response.json();
        const alternatives = data.availableDays || [];

        if (alternatives.length === 0) {
            ui.timeSlotsContainer.innerHTML = `
                <div class="col-span-full no-slots-container">
                    <div class="no-slots-message">
                        <span class="material-icons text-4xl text-gray-500 mb-2">event_busy</span>
                        <p class="text-gray-400">No hay horarios disponibles para este día</p>
                        <p class="text-sm text-gray-500 mt-2">No encontramos disponibilidad próxima. Por favor, intenta en otra fecha.</p>
                    </div>
                </div>
            `;
            return;
        }

        // Mostrar alternativas
        ui.timeSlotsContainer.innerHTML = `
            <div class="col-span-full no-slots-container">
                <div class="no-slots-message">
                    <span class="material-icons text-4xl text-gray-500 mb-2">event_busy</span>
                    <p class="text-gray-400 mb-4">No hay horarios disponibles para este día</p>
                </div>
                <div class="alternative-days-section">
                    <p class="text-sm text-accent mb-3">
                        <span class="material-icons text-sm align-middle">lightbulb</span>
                        Días cercanos con disponibilidad:
                    </p>
                    <div class="alternative-days-grid">
                        ${alternatives.map(day => `
                            <button class="alternative-day-btn" data-date="${escapeHtml(day.date)}">
                                <span class="alt-day-name">${escapeHtml(capitalizeFirst(day.dayName))}</span>
                                <span class="alt-day-date">${day.dayNumber} ${escapeHtml(day.month)}</span>
                                <span class="alt-day-slots">${day.availableSlots} horarios</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Agregar event listeners a los botones de días alternativos
        ui.timeSlotsContainer.querySelectorAll('.alternative-day-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newDate = btn.dataset.date;
                // Actualizar la fecha de la reserva
                state.activeBooking.dateKey = newDate;
                // Actualizar el título del modal con la nueva fecha
                const date = new Date(newDate + 'T00:00:00');
                if (ui.modalTitle) {
                    ui.modalTitle.textContent = `Reservar para el ${date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`;
                }
                // Cargar los horarios del nuevo día
                renderTimeSlotsForModal(newDate);
            });
        });

    } catch (error) {
        console.error('Error al buscar días alternativos:', error);
        ui.timeSlotsContainer.innerHTML = `
            <div class="col-span-full no-slots-container">
                <div class="no-slots-message">
                    <span class="material-icons text-4xl text-gray-500 mb-2">event_busy</span>
                    <p class="text-gray-400">No hay horarios disponibles para este día</p>
                    <p class="text-sm text-gray-500 mt-2">Selecciona otra fecha en el calendario.</p>
                </div>
            </div>
        `;
    }
}

/**
 * Capitaliza la primera letra de un string
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateConfirmBtnState() {
    ui.bookingNextBtn.disabled = !(state.activeBooking.barberId && state.activeBooking.serviceId && state.activeBooking.time);
}

// Flag para prevenir múltiples clics en reserva
let isBookingInProgress = false;

export async function handleBookingNextStep() {
    // Prevenir múltiples clics
    if (isBookingInProgress) return;

    if (state.currentUser) {
        // Verificar que hay barbero, servicio y horario seleccionados
        if (!state.activeBooking.barberId || !state.activeBooking.serviceId || !state.activeBooking.time) {
            ui.showToast('Por favor selecciona un barbero, servicio y horario.', 'warning');
            return;
        }
        // Mostrar resumen antes de confirmar
        showBookingSummary();
    } else {
        ui.bookingStep1.classList.add('hidden');
        ui.bookingStep2.classList.remove('hidden');
    }
}

/**
 * Muestra el modal de resumen de la cita antes de confirmar
 */
export function showBookingSummary() {
    // Prevenir múltiples llamadas
    if (isBookingInProgress) return;

    const { dateKey, serviceId, barberId, barberName, barberPhoto, time } = state.activeBooking;

    // Obtener información del servicio
    const service = state.siteContent?.services?.find(s => s.id === serviceId);
    const serviceName = service?.name || 'Servicio';
    const servicePrice = service?.price || 0;

    // Formatear la fecha
    const dateObj = new Date(dateKey + 'T12:00:00');
    const formattedDate = dateObj.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    const displayDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    // Mostrar modal de resumen
    ui.showBookingSummaryModal(
        {
            serviceName,
            servicePrice,
            date: displayDate,
            time,
            barberName: barberName || 'Sin asignar',
            barberPhoto: barberPhoto || ''
        },
        async (closeModal) => {
            // Usuario confirmó - proceder con la reserva
            isBookingInProgress = true;
            try {
                await finalizeBooking();
                closeModal();
            } catch (error) {
                // El error ya se maneja en finalizeBooking
                closeModal();
            } finally {
                isBookingInProgress = false;
            }
        },
        () => {
            // Usuario canceló - no hacer nada, volver al modal de reserva
            isBookingInProgress = false;
        }
    );
}

export async function finalizeBooking() {
    const { dateKey, serviceId, barberId, time } = state.activeBooking;
    const userEmail = state.currentUser.email;
    const btn = document.getElementById('client-login-btn') || document.getElementById('booking-next-btn');

    ui.setButtonLoadingState(btn, true, "Confirmando...");

    try {
        const response = await fetchWithRetry(
            `${API_BASE_URL}/appointments/create`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dateKey, serviceId, barberId, time, userEmail })
            },
            2, // reintentos
            15000 // timeout 15s para crear cita
        );

        if (!response.ok) {
            const errorInfo = await handleResponseError(response);
            throw errorInfo;
        }

        const data = await response.json();

        // Obtener nombre del servicio
        const service = state.siteContent?.services?.find(s => s.id === serviceId);
        const serviceName = service?.name || 'Servicio';

        // Formatear la fecha para mostrar
        const dateObj = new Date(dateKey + 'T12:00:00');
        const formattedDate = dateObj.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        // Capitalizar primera letra
        const displayDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

        ui.closeAllModals();

        // Mostrar modal de confirmación exitosa
        ui.showBookingSuccessModal({
            serviceName,
            date: displayDate,
            time,
            dateKey
        }, async () => {
            // Callback al cerrar el modal
            document.getElementById('user-portal-view').scrollIntoView({ behavior: 'smooth' });
        });

        // Actualizar datos en segundo plano
        await fetchAllAppointments();
        await renderUserPortal();
        renderClientCalendar();

    } catch (error) {
        console.error("Error al crear la cita:", error);

        // Mostrar mensaje de error específico según el tipo
        let errorMessage = 'No se pudo confirmar la cita. Intenta de nuevo.';
        let errorType = 'error';

        if (error.type === 'TIMEOUT') {
            errorMessage = 'La conexión tardó demasiado. Verifica tu internet e intenta de nuevo.';
        } else if (error.type === 'NETWORK') {
            errorMessage = 'Sin conexión a internet. Verifica tu red.';
        } else if (error.type === 'CONFLICT' || error.status === 409) {
            errorMessage = error.message || 'Este horario ya no está disponible. Por favor, selecciona otro.';
            // Refrescar los slots disponibles
            renderTimeSlotsForModal(dateKey);
        } else if (error.type === 'VALIDATION' || error.status === 400) {
            errorMessage = error.message || 'Datos inválidos. Por favor, verifica la información.';
        } else if (error.type === 'SERVER' || error.status >= 500) {
            errorMessage = 'Error del servidor. Intenta más tarde.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        ui.showToast(errorMessage, errorType);
    } finally {
        ui.setButtonLoadingState(btn, false, "Confirmar");
    }
}

// =======================================================
// UTILIDADES
// =======================================================

export function setupSmoothScroll() {
    // Este selector ahora es más específico y solo apunta a los enlaces de la vista de cliente
    const scrollLinks = document.querySelectorAll('.main-nav-link[href^="#"], #agendar-btn, .hero-section a[href^="#"]');

    scrollLinks.forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId && targetId.length > 1) {
                e.preventDefault();
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}

/**
 * Configura lazy loading mejorado para la galería usando IntersectionObserver
 */
function setupGalleryLazyLoading() {
    const images = document.querySelectorAll('.gallery-item img[data-src]');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const item = img.closest('.gallery-item');

                    // Cargar la imagen
                    img.src = img.dataset.src;

                    img.onload = () => {
                        img.classList.add('loaded');
                        if (item) item.classList.add('loaded');
                        img.removeAttribute('data-src');
                    };

                    img.onerror = () => {
                        // Si falla, mostrar placeholder
                        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect fill="%231a1a1a" width="400" height="300"/%3E%3Ctext fill="%23666" font-family="sans-serif" font-size="18" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
                        img.classList.add('loaded');
                        if (item) item.classList.add('loaded');
                    };

                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.01
        });

        images.forEach(img => imageObserver.observe(img));
    } else {
        // Fallback para navegadores sin IntersectionObserver
        images.forEach(img => {
            img.src = img.dataset.src;
            img.classList.add('loaded');
            const item = img.closest('.gallery-item');
            if (item) item.classList.add('loaded');
        });
    }
}

// =======================================================
// SECCIÓN DE TESTIMONIOS
// =======================================================

// Datos de testimonios por defecto (usado si falla la carga desde API)
const defaultTestimonials = [
    {
        id: 1,
        name: "Carlos Mendoza",
        rating: 5,
        text: "Excelente servicio, el mejor corte que me han hecho. El ambiente es increíble y el trato muy profesional.",
        avatar: "https://randomuser.me/api/portraits/men/32.jpg",
        verified: true
    },
    {
        id: 2,
        name: "Miguel Ángel",
        rating: 5,
        text: "Llevo más de un año viniendo y nunca me han decepcionado. La atención al detalle es impresionante.",
        avatar: "https://randomuser.me/api/portraits/men/45.jpg",
        verified: true
    },
    {
        id: 3,
        name: "Roberto García",
        rating: 5,
        text: "El sistema de citas online es muy práctico. Llegué, me atendieron a la hora exacta y salí con el mejor fade.",
        avatar: "https://randomuser.me/api/portraits/men/22.jpg",
        verified: true
    }
];

/**
 * Carga los testimonios desde la API
 */
export async function fetchTestimonials() {
    try {
        const response = await fetch(`${API_BASE_URL}/content/testimonials`);
        if (!response.ok) throw new Error('Error al cargar testimonios');

        const data = await response.json();
        const testimonials = data.testimonials || [];

        // Guardar en el state
        if (!state.siteContent) state.siteContent = {};
        state.siteContent.testimonials = testimonials.length > 0 ? testimonials : defaultTestimonials;

        return state.siteContent.testimonials;
    } catch (error) {
        console.error('Error al cargar testimonios:', error);
        // Usar testimonios por defecto en caso de error
        if (!state.siteContent) state.siteContent = {};
        state.siteContent.testimonials = defaultTestimonials;
        return defaultTestimonials;
    }
}

/**
 * Formatea la fecha de creación del testimonio
 */
function formatTestimonialDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return 'Hace ' + diffDays + ' día' + (diffDays > 1 ? 's' : '');
    if (diffDays <= 14) return 'Hace 1 semana';
    if (diffDays <= 30) return 'Hace ' + Math.floor(diffDays / 7) + ' semanas';
    if (diffDays <= 60) return 'Hace 1 mes';
    return 'Hace ' + Math.floor(diffDays / 30) + ' meses';
}

/**
 * Renderiza los testimonios en el slider
 */
export async function renderTestimonials() {
    const slider = document.getElementById('testimonials-slider');
    const dotsContainer = document.getElementById('testimonial-dots');

    if (!slider) return;

    // Cargar testimonios desde API si no están en el state
    if (!state.siteContent?.testimonials) {
        await fetchTestimonials();
    }

    // Usar testimonios del state o los predeterminados
    const testimonials = state.siteContent?.testimonials || defaultTestimonials;

    slider.innerHTML = '';

    testimonials.forEach((testimonial, index) => {
        const card = document.createElement('div');
        card.className = 'testimonial-card';
        card.dataset.index = index;

        // Generar estrellas
        const stars = Array(5).fill(0).map((_, i) =>
            `<span class="material-icons ${i < testimonial.rating ? '' : 'empty'}">star</span>`
        ).join('');

        // Formatear fecha
        const dateDisplay = testimonial.createdAt ? formatTestimonialDate(testimonial.createdAt) : (testimonial.date || '');

        card.innerHTML = `
            <div class="testimonial-rating">
                ${stars}
            </div>
            <p class="testimonial-text">"${escapeHtml(testimonial.text)}"</p>
            <div class="testimonial-author">
                ${testimonial.avatar ?
                    `<img src="${escapeHtml(testimonial.avatar)}" alt="${escapeHtml(testimonial.name)}" class="testimonial-avatar" loading="lazy">` :
                    `<div class="testimonial-avatar-placeholder"><span class="material-icons">person</span></div>`
                }
                <div class="testimonial-author-info">
                    <span class="testimonial-name">${escapeHtml(testimonial.name)}</span>
                    ${dateDisplay ? `<span class="testimonial-date">${escapeHtml(dateDisplay)}</span>` : ''}
                </div>
                ${testimonial.verified ? `
                    <span class="testimonial-verified">
                        <span class="material-icons">verified</span>
                        Verificado
                    </span>
                ` : ''}
            </div>
        `;

        slider.appendChild(card);
    });

    // Generar indicadores (dots)
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        const visibleCards = window.innerWidth < 768 ? 1 : 3;
        const totalDots = Math.ceil(testimonials.length / visibleCards);

        for (let i = 0; i < totalDots; i++) {
            const dot = document.createElement('button');
            dot.className = `slider-dot ${i === 0 ? 'active' : ''}`;
            dot.setAttribute('aria-label', `Ir al grupo ${i + 1}`);
            dot.dataset.index = i;
            dotsContainer.appendChild(dot);
        }
    }

    // Configurar controles del slider
    setupTestimonialsSlider();
}

/**
 * Configura los controles del slider de testimonios
 */
function setupTestimonialsSlider() {
    const slider = document.getElementById('testimonials-slider');
    const prevBtn = document.getElementById('testimonial-prev');
    const nextBtn = document.getElementById('testimonial-next');
    const dotsContainer = document.getElementById('testimonial-dots');

    if (!slider) return;

    let currentIndex = 0;
    const cards = slider.querySelectorAll('.testimonial-card');
    const cardWidth = cards[0]?.offsetWidth + 24 || 374; // 350px + 24px gap

    const scrollToIndex = (index) => {
        currentIndex = index;
        slider.scrollTo({
            left: index * cardWidth,
            behavior: 'smooth'
        });
        updateDots(index);
    };

    const updateDots = (index) => {
        if (!dotsContainer) return;
        const dots = dotsContainer.querySelectorAll('.slider-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    };

    // Botones de navegación
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            const newIndex = Math.max(0, currentIndex - 1);
            scrollToIndex(newIndex);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const maxIndex = cards.length - 1;
            const newIndex = Math.min(maxIndex, currentIndex + 1);
            scrollToIndex(newIndex);
        });
    }

    // Clicks en dots
    if (dotsContainer) {
        dotsContainer.addEventListener('click', (e) => {
            const dot = e.target.closest('.slider-dot');
            if (dot) {
                scrollToIndex(parseInt(dot.dataset.index));
            }
        });
    }

    // Actualizar dots al hacer scroll manual
    let scrollTimeout;
    slider.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const newIndex = Math.round(slider.scrollLeft / cardWidth);
            if (newIndex !== currentIndex) {
                currentIndex = newIndex;
                updateDots(newIndex);
            }
        }, 100);
    });

    // Auto-play (pausar al hover)
    let autoplayInterval;
    const startAutoplay = () => {
        autoplayInterval = setInterval(() => {
            const maxIndex = cards.length - 1;
            const newIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
            scrollToIndex(newIndex);
        }, 5000);
    };

    const stopAutoplay = () => {
        clearInterval(autoplayInterval);
    };

    slider.addEventListener('mouseenter', stopAutoplay);
    slider.addEventListener('mouseleave', startAutoplay);

    // Iniciar autoplay
    startAutoplay();
}