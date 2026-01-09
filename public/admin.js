// =======================================================
//         ARCHIVO COMPLETO Y CORREGIDO: admin.js
// =======================================================
import * as ui from './ui.js';
import { state } from './main.js';
import { API_BASE_URL } from './config.js';
import * as client from './client.js';

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

function renderAdminContentView() {
    renderAdminPaletteEditor();
    renderAdminTextsForm();
    renderAdminHeroBackgroundForm();
    renderAdminAboutSectionForm();
    renderAdminServicesList();
    renderAdminGalleryList();
    renderAdminLocationForm();
}

function renderInbox() {
    if (!ui.inboxList) return;
    ui.inboxList.innerHTML = '';

    const allApps = Object.values(state.allAppointments).flat();
    const upcomingApps = allApps
        .filter(app => new Date(app.dateKey) >= new Date())
        .sort((a, b) => new Date(a.dateKey + 'T' + a.time) - new Date(b.dateKey + 'T' + b.time));

    if (upcomingApps.length === 0) {
        ui.inboxList.innerHTML = '<p class="text-gray-500 p-4 text-center">No hay citas próximas.</p>';
        return;
    }

    upcomingApps.forEach(app => {
        const date = new Date(app.dateKey + 'T' + app.time);
        const card = document.createElement('div');
        card.className = 'p-4 bg-gray-800 rounded-lg border-l-4 border-yellow-500 mb-3';
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <h4 class="font-bold text-white">${app.userName}</h4>
                <span class="text-sm text-gray-400">${date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
            </div>
            <p class="text-gray-300">${app.serviceName}</p>
            <p class="text-yellow-500 font-semibold mt-1">${app.time}</p>
        `;
        ui.inboxList.appendChild(card);
    });
}

// archivo: admin.js
export async function openAdminDayModal(dateKey) {
    const date = new Date(dateKey + 'T00:00:00Z');
    ui.adminModalDate.textContent = `Agenda para el ${date.toLocaleDateString('es-ES', { dateStyle: 'full', timeZone: 'UTC' })}`;
    ui.adminModalList.innerHTML = '<p class="text-gray-400">Cargando disponibilidad...</p>';
    ui.adminDayModal.classList.remove('hidden');

    try {
        // 1. Obtenemos los horarios disponibles para ese día
        const response = await fetch(`${API_BASE_URL}/appointments/available-slots?date=${dateKey}`);
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
                slotDiv.className = `day-time-slot booked ${isCancelled ? 'cancelled-appointment' : ''}`;
                slotDiv.innerHTML = `
                    <div>
                        <p class="font-bold text-white">${bookedApp.time} - ${bookedApp.serviceName}</p>
                        <p class="text-sm text-gray-400">${bookedApp.userName}</p>
                    </div>
                    ${isCancelled ? '<span class="font-semibold text-red-500">CANCELADA</span>' : ''}
                `;
            } else {
                // Es un horario disponible
                slotDiv.className = 'day-time-slot available';
                slotDiv.dataset.time = time;
                slotDiv.dataset.dateKey = dateKey;
                slotDiv.innerHTML = `
                    <span class="font-bold text-green-400">${time}</span>
                    <span class="font-semibold text-green-400">Disponible</span>
                `;
            }
            ui.adminModalList.appendChild(slotDiv);
        });

    } catch (error) {
        console.error("Error al construir la agenda del día:", error);
        ui.adminModalList.innerHTML = '<p class="text-red-500">No se pudo cargar la disponibilidad del día.</p>';
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
                <p class="font-semibold text-white">${service.name}</p>
                <p class="text-sm text-gray-400">$${service.price} - ${service.duration} min</p>
            </div>
            <div class="flex gap-2">
                <button data-id="${service.id}" class="edit-service-btn p-2 hover:bg-gray-700 rounded-full"><span class="material-icons text-blue-400">edit</span></button>
                <button data-id="${service.id}" class="delete-service-btn p-2 hover:bg-gray-700 rounded-full"><span class="material-icons text-red-500">delete</span></button>
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
        div.className = 'relative admin-gallery-item';
        div.innerHTML = `
            <img src="${image.url}" alt="${image.altText}" class="w-full h-full object-cover rounded-md">
            <button data-id="${image.id}" class="delete-gallery-btn absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 leading-none">
                <span class="material-icons text-sm">close</span>
            </button>
        `;
        ui.adminGalleryList.appendChild(div);
    });
}

// =======================================================
// LÓGICA DE GUARDADO Y ELIMINACIÓN
// =======================================================

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
        const response = await fetch('http://localhost:3000/content/palette', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
    // Usamos el helper para mostrar un estado de carga en el botón de confirmación
    ui.setButtonLoadingState(confirmButton, true, 'Cancelando...');

    try {
        // Enviamos la petición al backend para que actualice el estado en la base de datos
        const response = await fetch(`http://localhost:3000/appointments/${appointmentId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        ui.showToast(result.message);

        if (response.ok) {
            // --- LÓGICA CORREGIDA PARA ACTUALIZAR LA VISTA ---

            // 1. Buscamos la cita en nuestro estado local (state)
            const dateKey = cardElement.dataset.dateKey;
            const appointment = state.allAppointments[dateKey]?.find(app => app.id === appointmentId);
            
            // 2. Si la encontramos, actualizamos su estado a 'CANCELLED'
            if (appointment) {
                appointment.status = 'CANCELLED';
            }

            // 3. Volvemos a renderizar las vistas afectadas para que reflejen el cambio
            openAdminDayModal(dateKey); // Re-dibuja el modal con la cita ahora marcada como cancelada
            ui.renderCalendar(ui.adminCalendarGrid, ui.adminMonthYearEl, state.currentAdminDate, state.allAppointments);
            renderInbox(); // Actualiza también el buzón de citas por si estaba ahí
        }
    } catch (error) {
        console.error("Error al cancelar la cita:", error);
        ui.showToast("Error de conexión al cancelar la cita.");
        // Si hay un error, volvemos a renderizar el modal para restablecer los botones
        const dateKey = cardElement.dataset.dateKey;
        openAdminDayModal(dateKey);
    }
}

export async function handleSaveTexts() {
    const btn = document.getElementById('save-texts-btn');
    ui.setButtonLoadingState(btn, true, 'Guardando...');
    const textData = {
        heroTitle: document.getElementById('edit-hero-title').value,
        heroSubtitle: document.getElementById('edit-hero-subtitle').value,
    };
    try {
        const response = await fetch('http://localhost:3000/content/texts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
                const uploadResponse = await fetch('http://localhost:3000/upload', { method: 'POST', body: formData });
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
        const response = await fetch('http://localhost:3000/content/hero-background', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
            const uploadResponse = await fetch('http://localhost:3000/upload', { method: 'POST', body: formData });
            const uploadData = await uploadResponse.json();
            if (!uploadData.success) throw new Error('Falló la subida de la imagen.');
            imageUrl = uploadData.url; // Usamos la URL de Cloudinary
        }
        const aboutData = {
            text: document.getElementById('edit-about-text-2').value.replace(/\n/g, '<br>'),
            image: imageUrl
        };
        // SEGUNDO, guardamos el contenido (con la URL nueva o la antigua)
        const response = await fetch('http://localhost:3000/content/about', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
        const uploadResponse = await fetch('http://localhost:3000/upload', { method: 'POST', body: formData });
        const uploadData = await uploadResponse.json();
        if (!uploadData.success) throw new Error('Falló la subida de la imagen.');
        
        // SEGUNDO, guardamos la referencia en la galería con la URL de Cloudinary
        const response = await fetch('http://localhost:3000/gallery/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch('http://localhost:3000/content/location', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
    const url = isNew ? 'http://localhost:3000/content/services' : `http://localhost:3000/content/services/${serviceId}`;
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
            headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch(`http://localhost:3000/content/services/${serviceId}`, { method: 'DELETE' });
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
        const response = await fetch(`http://localhost:3000/gallery/images/${imageId}`, { method: 'DELETE' });
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
        const response = await fetch('http://localhost:3000/schedule');
        const scheduleData = await response.json();
        const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        scheduleData.forEach(day => {
            const workingHours = JSON.parse(day.workingHours);
            const isOffClass = day.isDayOff ? 'opacity-40' : '';
            const dayRow = document.createElement('div');
            dayRow.className = 'grid grid-cols-1 md:grid-cols-3 items-center gap-4 p-4 rounded-lg bg-gray-800';
            dayRow.dataset.day = day.dayOfWeek;
            let dayHeaderHTML = `<div class="flex items-center gap-4"><input type="checkbox" id="off-${day.dayOfWeek}" class="h-5 w-5 rounded day-off-checkbox" ${day.isDayOff ? 'checked' : ''}><label for="off-${day.dayOfWeek}" class="font-bold text-lg text-white">${days[day.dayOfWeek]}</label></div>`;
            let intervalsHTML = `<div id="intervals-for-${day.dayOfWeek}" class="space-y-2 ${isOffClass}">`;
            if (workingHours.length > 0) {
                workingHours.forEach((interval, index) => {
                    intervalsHTML += `<div class="flex items-center gap-2 time-interval-row"><input type="time" value="${interval.start}" class="schedule-time-input start-time" ${day.isDayOff ? 'disabled' : ''}><span class="text-gray-400">-</span><input type="time" value="${interval.end}" class="schedule-time-input end-time" ${day.isDayOff ? 'disabled' : ''}><button class="remove-interval-btn p-1 text-red-500 hover:bg-red-900 rounded-full ${index === 0 ? 'invisible' : ''}" aria-label="Eliminar intervalo">&times;</button></div>`;
                });
            } else {
                 intervalsHTML += `<div class="flex items-center gap-2 time-interval-row"><input type="time" value="09:00" class="schedule-time-input start-time" disabled><span class="text-gray-400">-</span><input type="time" value="18:00" class="schedule-time-input end-time" disabled><button class="remove-interval-btn p-1 text-red-500 hover:bg-red-900 rounded-full invisible" aria-label="Eliminar intervalo">&times;</button></div>`;
            }
            intervalsHTML += `</div>`;
            let controlsHTML = `<div class="flex items-center justify-end gap-4 ${isOffClass}"><span class="text-gray-400 status-text">${day.isDayOff ? 'Cerrado' : 'Abierto'}</span><button class="add-interval-btn p-2 bg-green-600 hover:bg-green-700 rounded-full" aria-label="Añadir intervalo">+</button></div>`;
            dayRow.innerHTML = dayHeaderHTML + intervalsHTML + controlsHTML;
            container.appendChild(dayRow);
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
        const response = await fetch('http://localhost:3000/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch('http://localhost:3000/schedule/overrides');
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
        const response = await fetch('http://localhost:3000/schedule/overrides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch(`http://localhost:3000/schedule/overrides/${date}`, { method: 'DELETE' });
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
    function showSection(targetId) {
        // 1. Oculta TODAS las secciones de contenido
        sections.forEach(section => {
            section.style.display = 'none';
        });

        // 2. Muestra SOLAMENTE la sección que corresponde al ID del enlace
        const targetSection = document.querySelector(targetId);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        // 3. Actualiza la clase 'active' en los enlaces del menú
        links.forEach(link => {
            const isActive = link.getAttribute('href') === targetId;
            link.classList.toggle('active', isActive);
        });
    }

    // Añadimos un evento de clic a cada enlace del menú lateral
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Prevenimos el salto de página
            const targetId = link.getAttribute('href');
            showSection(targetId);
        });
    });

    // Al cargar la página, mostramos la primera sección por defecto
    if (links.length > 0) {
        showSection(links[0].getAttribute('href'));
    }
}
// =======================================================
// EVENT LISTENERS DEL PANEL DE ADMIN
// =======================================================
function setupAdminEventListeners() {
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
        if (e.target.classList.contains('add-interval-btn')) {
            const intervalsDiv = e.target.closest('.grid').querySelector('[id^="intervals-for-"]');
            const newInterval = document.createElement('div');
            newInterval.className = 'flex items-center gap-2 time-interval-row';
            newInterval.innerHTML = `<input type="time" value="09:00" class="schedule-time-input start-time"><span class="text-gray-400">-</span><input type="time" value="18:00" class="schedule-time-input end-time"><button class="remove-interval-btn p-1 text-red-500 hover:bg-red-900 rounded-full" aria-label="Eliminar intervalo">&times;</button>`;
            intervalsDiv.appendChild(newInterval);
        }
        if (e.target.classList.contains('remove-interval-btn')) {
            e.target.closest('.time-interval-row').remove();
        }
    });
    scheduleContainer?.addEventListener('change', (e) => {
        if (e.target.classList.contains('day-off-checkbox')) {
            const row = e.target.closest('[data-day]');
            const isOff = e.target.checked;
            row.querySelector('[id^="intervals-for-"]').classList.toggle('opacity-40', isOff);
            row.querySelector('.status-text').textContent = isOff ? 'Cerrado' : 'Abierto';
            row.querySelectorAll('.schedule-time-input').forEach(input => input.disabled = isOff);
        }
    });
    document.getElementById('save-schedule-btn')?.addEventListener('click', saveSchedule);

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
}