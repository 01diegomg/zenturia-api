// --- client.js (Versión Final y Corregida) ---
import * as ui from './ui.js';
import { API_BASE_URL } from './config.js';
import { state } from './main.js';

// =======================================================
// FUNCIONES DE OBTENCIÓN DE DATOS (FETCHING)
// =======================================================

/**
 * Obtiene todas las citas del servidor y las guarda en el estado global.
 * Lanza un error si la petición falla para detener la ejecución.
 */
export async function fetchAllAppointments() {
    try {
        // Se añaden headers anti-caché para garantizar datos siempre frescos.
         const response = await fetch(`${API_BASE_URL}/appointments?t=${new Date().getTime()}`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
        if (!response.ok) {
            throw new Error('No se pudieron cargar las citas desde el servidor.');
        }
        state.allAppointments = await response.json();
    } catch (error) {
        console.error("Error en fetchAllAppointments:", error);
        ui.showToast("No se pudo sincronizar con el calendario del servidor.");
        throw error; // Vuelve a lanzar el error para que funciones superiores lo capturen
    }
}

/**
 * Obtiene todo el contenido público del sitio, lo guarda en el estado global,
 * y aplica la paleta de colores.
 */
export async function fetchSiteContent() {
    try {
        const response = await fetch('http://localhost:3000/content/public');
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
    
    const { hero, about, location, services, gallery } = state.siteContent;

    const heroSection = document.getElementById('inicio');
    if (heroSection && hero) {
        heroSection.style.backgroundImage = (hero.backgroundType === 'IMAGE') ? `url('${hero.backgroundValue}')` : '';
        heroSection.style.backgroundColor = (hero.backgroundType === 'COLOR') ? hero.backgroundValue : 'transparent';
        ui.welcomeMessage.textContent = hero.title;
        ui.heroSubtitle.textContent = hero.subtitle;
    }

    if (about) {
        document.getElementById('about-section-image').src = about.image;
        ui.aboutTextContainer.innerHTML = about.text;
    }

    if (location) {
        document.getElementById('location-address').innerHTML = location.address;
        document.getElementById('location-schedule').innerHTML = location.schedule;
        document.getElementById('location-map').src = location.mapUrl;
    }
    
    ui.servicesListContainer.innerHTML = '';
    services.forEach(service => {
        const serviceLink = document.createElement('a');
        serviceLink.href = '#agendar';
        serviceLink.className = "bg-[#1a1a1a] p-8 rounded-lg shadow-lg transform hover:-translate-y-2 transition-transform duration-300 block";
        serviceLink.innerHTML = `
            <h3 class="font-display text-2xl text-accent mb-3">${service.name}</h3>
            <p class="text-subtle mb-4">${service.description}</p>
            <div class="flex justify-between items-center">
                <span class="text-main inline-flex items-center"><span class="material-icons text-sm mr-1">schedule</span>${service.duration} min</span>
                <span class="text-xl font-semibold text-main">$${service.price}</span>
            </div>`;
        ui.servicesListContainer.appendChild(serviceLink);
    });

    ui.galleryContainer.innerHTML = ''; 
    if (gallery && gallery.length > 0) {
        gallery.forEach(image => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <img src="${image.url}" alt="${image.altText}" loading="lazy">
                <div class="gallery-overlay"><p>${image.altText}</p></div>
            `;
            ui.galleryContainer.appendChild(item);
        });
    } else {
        ui.galleryContainer.innerHTML = '<p class="text-subtle col-span-full text-center">Próximamente, los mejores momentos de nuestro estudio.</p>';
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
    upcomingList.innerHTML = '';
    pastList.innerHTML = '';

    if (!state.currentUser || state.currentUser.role !== 'client') {
        upcomingList.innerHTML = '<p class="text-subtle">Inicia sesión para ver tus citas.</p>';
        return;
    }

    try {
        const allAppointmentsFlat = Object.values(state.allAppointments).flat();
        const userAppointments = allAppointmentsFlat.filter(app => app.userEmail === state.currentUser.email);
        const now = new Date();
        
        const upcoming = userAppointments.filter(app => new Date(app.dateKey + 'T' + app.time) > now);
        const past = userAppointments.filter(app => new Date(app.dateKey + 'T' + app.time) <= now);
        
        if (upcoming.length === 0) {
            upcomingList.innerHTML = '<p class="text-subtle">No tienes citas próximas.</p>';
        } else {
            upcoming.sort((a, b) => new Date(a.dateKey + 'T' + a.time) - new Date(b.dateKey + 'T' + b.time)).forEach(app => {
                const card = document.createElement('div');
                
                // --- LÓGICA AÑADIDA ---
                const isCancelled = app.status === 'CANCELLED';
                // Añadimos la clase 'cancelled-appointment' si la cita está cancelada
                card.className = `client-appointment-card ${isCancelled ? 'cancelled-appointment' : ''}`;
                card.dataset.appointmentId = app.id;
                card.dataset.dateKey = app.dateKey;
                
                const appDate = new Date(app.dateKey + 'T' + app.time);
                
                // Si la cita está cancelada, no mostramos el botón de cancelar
                const actionButtonHTML = isCancelled
                    ? '<p class="text-red-500 font-semibold text-right">CANCELADA</p>'
                    : `<div class="appointment-actions">
                           <button class="cancel-appointment-btn">Cancelar</button>
                       </div>
                       <div class="appointment-confirm-cancel hidden">
                           <p>¿Seguro?</p>
                           <button class="confirm-cancel-btn">Sí</button>
                           <button class="abort-cancel-btn">No</button>
                       </div>`;
                
                card.innerHTML = `
                    <div class="appointment-details">
                        <h4 class="font-display text-xl text-main mb-2">${app.serviceName}</h4>
                        <div class="details text-main space-y-1">
                            <p class="flex items-center gap-2"><span class="material-icons text-sm">event</span>${appDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                            <p class="flex items-center gap-2"><span class="material-icons text-sm">schedule</span>${appDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>
                    ${actionButtonHTML}`;
                
                upcomingList.appendChild(card);
            });
        }

        if (past.length === 0) {
            pastList.innerHTML = '<p class="text-subtle">No tienes citas en tu historial.</p>';
        } else {
             // Lógica para mostrar citas pasadas (se mantiene igual)
             past.sort((a, b) => new Date(b.dateKey + 'T' + b.time) - new Date(a.dateKey + 'T' + a.time)).forEach(app => {
                const item = document.createElement('div');
                const isCancelled = app.status === 'CANCELLED';
                item.className = `flex justify-between items-center bg-gray-800 p-3 rounded-md ${isCancelled ? 'opacity-50' : ''}`;
                const appDate = new Date(app.dateKey + 'T' + app.time);
                item.innerHTML = `
                    <div>
                        <span class="text-main">${appDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span class="font-semibold text-main ml-4">${app.serviceName}</span>
                    </div>
                    ${isCancelled ? '<span class="text-red-500 text-xs font-bold">CANCELADA</span>' : ''}
                `;
                pastList.appendChild(item);
            });
        }
    } catch (error) {
        console.error("Error al renderizar portal de usuario:", error);
        upcomingList.innerHTML = '<p class="text-red-500">No se pudieron cargar tus citas.</p>';
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
        const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}?cancelledBy=client`, {
            method: 'DELETE'
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
    state.activeBooking = { dateKey, serviceId: null, time: null };
    const date = new Date(dateKey + 'T00:00:00Z');
    
    ui.modalTitle.textContent = `Reserva para el ${date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}`;
    
    ui.bookingStep1.classList.remove('hidden');
    ui.bookingStep2.classList.add('hidden');
    ui.clientLoginView.classList.remove('hidden');
    ui.clientRegisterView.classList.add('hidden');
    
    ui.bookingNextBtn.textContent = state.currentUser ? "Confirmar Cita" : "Siguiente";
    
    renderServicesForBookingModal();
    renderTimeSlotsForModal(dateKey);
    updateConfirmBtnState();
    
    ui.bookingModal.classList.remove('hidden');
}

function renderServicesForBookingModal() {
    ui.serviceSelectionContainer.innerHTML = '';
    if (!state.siteContent?.services || state.siteContent.services.length === 0) {
        ui.serviceSelectionContainer.innerHTML = "<p class='text-yellow-400'>No hay servicios disponibles para reservar.</p>";
        return;
    }
    
    state.siteContent.services.forEach(service => {
        const label = document.createElement('label');
        label.className = "block p-4 rounded-lg bg-gray-800 border-2 border-gray-700 cursor-pointer transition-all";
        label.innerHTML = `
            <input type="radio" name="service" value="${service.id}" class="hidden">
            <div class="flex justify-between items-center">
                <span class="font-semibold text-main">${service.name}</span>
                <span class="text-accent font-bold">$${service.price}</span>
            </div>`;
        label.addEventListener('click', () => {
            ui.serviceSelectionContainer.querySelectorAll('label').forEach(l => l.classList.remove('selected'));
            label.classList.add('selected');
            state.activeBooking.serviceId = service.id;
            updateConfirmBtnState();
        });
        ui.serviceSelectionContainer.appendChild(label);
    });
}

async function renderTimeSlotsForModal(dateKey) {
    ui.timeSlotsContainer.innerHTML = '<div class="col-span-full text-center p-4 text-subtle">Cargando disponibilidad...</div>';
    
    try {
        const response = await fetch(`http://localhost:3000/appointments/available-slots?date=${dateKey}`);
        if (!response.ok) throw new Error('Respuesta del servidor no fue OK');
        
        const availableHours = await response.json();
        ui.timeSlotsContainer.innerHTML = '';

        if (availableHours.length === 0) {
            ui.timeSlotsContainer.innerHTML = `<div class="col-span-full text-center p-4 bg-gray-800 rounded-md text-subtle">No hay horarios disponibles para este día.</div>`;
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
        ui.timeSlotsContainer.innerHTML = `<div class="col-span-full text-center p-4 bg-red-800 rounded-md text-red-300">No se pudo cargar la disponibilidad. Inténtalo de nuevo.</div>`;
    }
}

function updateConfirmBtnState() {
    ui.bookingNextBtn.disabled = !(state.activeBooking.serviceId && state.activeBooking.time);
}

export async function handleBookingNextStep() {
    if (state.currentUser) {
        await finalizeBooking();
    } else {
        ui.bookingStep1.classList.add('hidden');
        ui.bookingStep2.classList.remove('hidden');
    }
}

export async function finalizeBooking() {
    const { dateKey, serviceId, time } = state.activeBooking;
    const userEmail = state.currentUser.email;
    const btn = document.getElementById('client-login-btn') || document.getElementById('booking-next-btn');
    
    ui.setButtonLoadingState(btn, true, "Confirmando...");

    try {
        const response = await fetch('http://localhost:3000/appointments/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dateKey, serviceId, time, userEmail })
        });
        const data = await response.json();
        if (response.ok) {
            ui.showToast(data.message);
            ui.closeAllModals();
            await fetchAllAppointments();
            await renderUserPortal();
            renderClientCalendar();
            document.getElementById('user-portal-view').scrollIntoView({ behavior: 'smooth' });
        } else {
            ui.showToast(data.message);
        }
    } catch (error) {
        console.error("Error al crear la cita:", error);
        ui.showToast("No se pudo conectar al servidor para confirmar la cita.");
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