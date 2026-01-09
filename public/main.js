// =======================================================
//         ARCHIVO COMPLETO Y CORREGIDO: main.js
// =======================================================
import * as ui from './ui.js';
import * as client from './client.js';
import * as auth from './auth.js';
import * as admin from './admin.js';
import { API_BASE_URL } from './config.js';

/**
 * El estado global de la aplicación. Centraliza todos los datos dinámicos.
 */
export let state = {
    currentUser: JSON.parse(sessionStorage.getItem('barber_currentUser')) || null,
    currentClientDate: new Date(),
    currentAdminDate: new Date(),
    currentOverrideDate: new Date(),
    activeBooking: null,
    siteContent: null,
    allAppointments: {},
    scheduleOverrides: [],
};

// =======================================================
// === FUNCIONES PARA LA NAVEGACIÓN INTELIGENTE ===
// =======================================================

function handleHeaderScroll() {
  const header = document.querySelector('header');
  if (!header) return;
  if (window.scrollY > 50) {
    header.classList.add('header-scrolled');
  } else {
    header.classList.remove('header-scrolled');
  }
}

function setupScrollSpy() {
  const sections = document.querySelectorAll('main#client-main-view section[id]');
  const navLinks = document.querySelectorAll('#main-nav a.main-nav-link');
  if (sections.length === 0 || navLinks.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.toggle('nav-link-active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      }
    });
  }, { rootMargin: '-50% 0px -50% 0px' });

  sections.forEach(section => observer.observe(section));
}

function handleBackToTopButton() {
  const btn = document.getElementById('back-to-top-btn');
  if (!btn) return;
  if (window.scrollY > 300) {
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
}

/**
 * Configura todos los event listeners de la aplicación.
 */
function setupEventListeners() {
    // --- Autenticación y Navegación Principal ---
    ui.adminLink?.addEventListener('click', (e) => {
        e.preventDefault();
        ui.adminLoginModal?.classList.remove('hidden');
    });
    ui.adminLoginBtn?.addEventListener('click', () => 
        auth.handleAdminLogin(
            document.getElementById('admin-user')?.value, 
            document.getElementById('admin-pass')?.value
        )
    );

    // --- Lógica del Menú de Usuario ---
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
    const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');

    userMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenuDropdown.classList.toggle('open');
    });

    dropdownLogoutBtn?.addEventListener('click', auth.handleLogout);

    window.addEventListener('click', () => {
        if (userMenuDropdown?.classList.contains('open')) {
            userMenuDropdown.classList.remove('open');
        }
    });

    // --- Flujo de Reserva y Login/Registro de Cliente ---
    ui.clientLoginBtn?.addEventListener('click', async () => {
        const loginSuccess = await auth.handleClientLogin();
        if (loginSuccess) await client.finalizeBooking();
    });
    ui.clientRegisterBtn?.addEventListener('click', async () => {
        const registerSuccess = await auth.handleClientRegister();
        if (registerSuccess) await client.finalizeBooking();
    });
    ui.showRegisterBtn?.addEventListener('click', () => {
        ui.clientLoginView?.classList.add('hidden');
        ui.clientRegisterView?.classList.remove('hidden');
    });
    ui.showLoginBtn?.addEventListener('click', () => {
        ui.clientRegisterView?.classList.add('hidden');
        ui.clientLoginView?.classList.remove('hidden');
    });
    ui.bookingNextBtn?.addEventListener('click', client.handleBookingNextStep);

    // --- Lógica de Cierre de Modales ---
    document.body.addEventListener('click', (e) => {
    // Si se hace clic en un botón de cerrar 'X'
        if (e.target.closest('.close-modal-btn')) {
        // Busca el modal más cercano y ciérralo
            const modalToClose = e.target.closest('.modal-overlay');
            if (modalToClose) {
                modalToClose.classList.add('hidden');
            }
        } 
    // Si se hace clic en el fondo oscuro (overlay)
        else if (e.target.classList.contains('modal-overlay')) {
        // Cierra todos los modales
            ui.closeAllModals();
        }
    });

    // --- Calendario de Clientes ---
    ui.userCalendarGrid?.addEventListener('click', (e) => {
        const dayCell = e.target.closest('.calendar-day:not(.empty):not(.past-day)');
        if (dayCell) {
            client.openBookingModal(dayCell.dataset.dateKey);
        }
    });
    ui.userPrevMonthBtn?.addEventListener('click', () => {
        state.currentClientDate.setMonth(state.currentClientDate.getMonth() - 1);
        client.renderClientCalendar();
    });
    ui.userNextMonthBtn?.addEventListener('click', () => {
        state.currentClientDate.setMonth(state.currentClientDate.getMonth() + 1);
        client.renderClientCalendar();
    });

    // --- Calendario Principal del Admin ---
    ui.adminCalendarGrid?.addEventListener('click', (e) => {
        const dayCell = e.target.closest('.calendar-day:not(.empty)');
        if (dayCell) admin.openAdminDayModal(dayCell.dataset.dateKey);
    });
    ui.adminPrevMonthBtn?.addEventListener('click', () => {
        state.currentAdminDate.setMonth(state.currentAdminDate.getMonth() - 1);
        ui.renderCalendar(ui.adminCalendarGrid, ui.adminMonthYearEl, state.currentAdminDate, state.allAppointments);
    });
    ui.adminNextMonthBtn?.addEventListener('click', () => {
        state.currentAdminDate.setMonth(state.currentAdminDate.getMonth() + 1);
        ui.renderCalendar(ui.adminCalendarGrid, ui.adminMonthYearEl, state.currentAdminDate, state.allAppointments);
    });
    
    // --- Pestañas del Panel de Admin ---
    document.querySelector('.login-tabs')?.addEventListener('click', (e) => {
        const clickedTab = e.target.closest('.tab-button');
        if (!clickedTab) return;
        document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
        clickedTab.classList.add('active');
        const tabName = clickedTab.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tabContent === tabName);
        });
    });

    // --- Listener UNIFICADO para el Modal de Citas del Admin (Agenda Interactiva y Cancelaciones) ---
    ui.adminModalList?.addEventListener('click', (e) => {
        const availableSlot = e.target.closest('.day-time-slot.available');
        const card = e.target.closest('.admin-appointment-card');

        // CASO 1: Clic en un horario disponible para agendar manualmente
        if (availableSlot) {
            const { time, dateKey } = availableSlot.dataset;
            const modal = document.getElementById('manual-booking-modal');
            const title = document.getElementById('manual-booking-title');
            const serviceSelect = document.getElementById('manual-booking-service');
            const confirmBtn = document.getElementById('confirm-manual-booking-btn');
            
            title.textContent = `Agendar para las ${time}`;
            serviceSelect.innerHTML = state.siteContent.services.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            confirmBtn.dataset.time = time;
            confirmBtn.dataset.dateKey = dateKey;
            modal.classList.remove('hidden');
            return; 
        }

        // CASO 2: Clic en una cita ya agendada para cancelar
        if (card) {
            const appointmentId = card.dataset.appointmentId;
            const confirmDialog = card.querySelector('.appointment-confirm-delete');

            if (e.target.closest('.delete-appointment-btn')) {
                card.classList.add('confirming-delete');
                confirmDialog?.classList.remove('hidden');
            }
            if (e.target.closest('.cancel-delete-btn')) {
                card.classList.remove('confirming-delete');
                confirmDialog?.classList.add('hidden');
            }
            const confirmBtn = e.target.closest('.confirm-delete-btn');
            if (confirmBtn) {
                if (appointmentId) {
                    admin.handleDeleteAppointment(appointmentId, card, confirmBtn);
                }
            }
        }
    });

    // --- Listener para el botón de confirmar en el modal de bloqueo rápido ---
    document.getElementById('confirm-manual-booking-btn')?.addEventListener('click', async (e) => {
        const btn = e.target;
        const { time, dateKey } = btn.dataset;
        const serviceId = document.getElementById('manual-booking-service').value;

        ui.setButtonLoadingState(btn, true, 'Agendando...');
        try {
            const response = await fetch(`${API_BASE_URL}/appointments/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dateKey, time, serviceId, userEmail: 'walkin@barberia.com' })
            });
            const result = await response.json();
            ui.showToast(result.message);

            if (response.ok) {
                await client.fetchAllAppointments();
                admin.openAdminDayModal(dateKey);
                ui.renderCalendar(ui.adminCalendarGrid, ui.adminMonthYearEl, state.currentAdminDate, state.allAppointments);
                document.getElementById('manual-booking-modal')?.classList.add('hidden');
            }
        } catch (error) {
            ui.showToast('Error de conexión al agendar la cita.');
        } finally {
            ui.setButtonLoadingState(btn, false, 'Confirmar y Agendar');
        }
    });

    // --- Listeners para otros Modales de Edición (Admin) ---
    document.getElementById('add-service-btn')?.addEventListener('click', () => {
        document.getElementById('editor-modal-title').textContent = 'Añadir Nuevo Ritual';
        document.getElementById('edit-service-id').value = '';
        document.getElementById('edit-service-name').value = '';
        document.getElementById('edit-service-description').value = '';
        document.getElementById('edit-service-price').value = '';
        document.getElementById('edit-service-duration').value = '';
        ui.contentEditorModal?.classList.remove('hidden');
    });

    ui.adminServicesList?.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-service-btn');
        const deleteBtn = e.target.closest('.delete-service-btn');
        if (editBtn) {
            const serviceId = editBtn.dataset.id;
            const service = state.siteContent.services.find(s => s.id === serviceId);
            if (service) {
                document.getElementById('editor-modal-title').textContent = 'Editar Ritual';
                document.getElementById('edit-service-id').value = service.id;
                document.getElementById('edit-service-name').value = service.name;
                document.getElementById('edit-service-description').value = service.description;
                document.getElementById('edit-service-price').value = service.price;
                document.getElementById('edit-service-duration').value = service.duration;
                ui.contentEditorModal?.classList.remove('hidden');
            }
        }
        if (deleteBtn) {
            admin.handleDeleteService(deleteBtn.dataset.id);
        }
    });

    document.getElementById('add-gallery-image-btn')?.addEventListener('click', () => {
        ui.galleryEditorModal?.classList.remove('hidden');
        document.getElementById('edit-gallery-file').value = '';
        document.getElementById('image-preview-container')?.classList.add('hidden');
        document.getElementById('edit-gallery-alt').value = '';
        document.getElementById('save-gallery-image-btn').disabled = true;
    });
    
    document.querySelectorAll('input[name="bg-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const imageControls = document.getElementById('hero-bg-image-controls');
            const colorControls = document.getElementById('hero-bg-color-controls');
            if (e.target.value === 'IMAGE') {
                imageControls.classList.remove('hidden');
                colorControls.classList.add('hidden');
            } else {
                imageControls.classList.add('hidden');
                colorControls.remove('hidden');
            }
        });
    });

    // --- Listener para la Galería Lightbox ---
    document.getElementById('gallery-container')?.addEventListener('click', (e) => {
        const item = e.target.closest('.gallery-item');
        if (item) {
            const imgSrc = item.querySelector('img')?.src;
            if (imgSrc) {
                const lightboxModal = document.getElementById('gallery-lightbox-modal');
                const lightboxImage = document.getElementById('lightbox-image');
                if(lightboxImage && lightboxModal) {
                    lightboxImage.src = imgSrc;
                    lightboxModal.classList.remove('hidden');
                }
            }
        }
    });

    // --- Listener de Cancelación de Citas del Cliente ---
    document.getElementById('upcoming-appointments-list')?.addEventListener('click', (e) => {
        const card = e.target.closest('.client-appointment-card');
        if (!card) return;

        const appointmentId = card.dataset.appointmentId;

        if (e.target.closest('.cancel-appointment-btn')) {
            card.classList.add('confirming-cancel');
        }
        if (e.target.closest('.abort-cancel-btn')) {
            card.classList.remove('confirming-cancel');
        }
        if (e.target.closest('.confirm-cancel-btn')) {
            if (appointmentId) {
                client.handleCancelAppointment(appointmentId, card);
            }
        }
    });
}

/**
 * Función de inicialización principal de la aplicación.
 */
async function initApp() {
    setupEventListeners();
    
    // --- LÓGICA PARA LA NAVEGACIÓN INTELIGENTE ---
    handleHeaderScroll();
    handleBackToTopButton();
    setupScrollSpy();
    
    window.addEventListener('scroll', () => {
        handleHeaderScroll();
        handleBackToTopButton();
    });

    const backToTopButton = document.getElementById('back-to-top-btn');
    if (backToTopButton) {
        backToTopButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- FIN DE LA LÓGICA DE NAVEGACIÓN ---
    try {
        await client.fetchSiteContent();
        client.renderPublicSite();
        ui.updateUIAfterLogin();

        if (state.currentUser?.role === 'admin') {
            ui.showView('admin');
            await admin.renderAdminView();
        } else {
            ui.showView('client');
            await client.fetchAllAppointments();
            await client.renderUserPortal();
            client.renderClientCalendar();
        }
        
        client.setupSmoothScroll();
    } catch (error) {
        console.error("Error fatal al inicializar la aplicación:", error);
        document.getElementById('app-container').innerHTML = `
            <div class="h-screen flex items-center justify-center text-center text-white">
                <div>
                    <h1 class="text-4xl font-display text-red-500">Error de Conexión</h1>
                    <p class="mt-4 text-lg">No se pudo cargar la aplicación. Por favor, asegúrate de que el servidor esté funcionando y recarga la página.</p>
                </div>
            </div>
        `;
    }
}

// Punto de entrada de la aplicación
document.addEventListener('DOMContentLoaded', initApp);