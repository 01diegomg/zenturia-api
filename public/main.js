// =======================================================
//         ARCHIVO COMPLETO Y CORREGIDO: main.js
// =======================================================
import * as ui from './ui.js';
import * as client from './client.js';
import * as auth from './auth.js';
import * as admin from './admin.js';
import { API_BASE_URL } from './config.js';
import { authFetch } from './auth.js';
import router from './router.js';

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
  const topBar = document.getElementById('top-bar');
  if (!header) return;

  if (window.scrollY > 50) {
    header.classList.add('header-scrolled');
    // Ocultar cintillo y ajustar header cuando se hace scroll
    if (topBar) {
      topBar.classList.add('top-bar-hidden');
      header.style.top = '0';
    }
  } else {
    header.classList.remove('header-scrolled');
    // Mostrar cintillo y ajustar header (solo si no está en vista admin)
    if (topBar && !topBar.classList.contains('admin-hidden')) {
      topBar.classList.remove('top-bar-hidden');
      header.style.top = '37px';
    }
  }
}

/**
 * Oculta o muestra el cintillo según la vista (admin/cliente)
 */
export function toggleTopBarForView(isAdmin) {
  const topBar = document.getElementById('top-bar');
  const header = document.querySelector('header');
  if (!topBar || !header) return;

  if (isAdmin) {
    topBar.classList.add('top-bar-hidden', 'admin-hidden');
    header.style.top = '0';
    header.classList.remove('header-with-topbar');
  } else {
    topBar.classList.remove('admin-hidden');
    header.classList.add('header-with-topbar');
    if (window.scrollY <= 50) {
      topBar.classList.remove('top-bar-hidden');
      header.style.top = '37px';
    }
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
 * Configura el menú móvil hamburger
 */
function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuClose = document.getElementById('mobile-menu-close');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    const mobileAgendarBtn = document.getElementById('mobile-agendar-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

    function openMobileMenu() {
        mobileMenu?.classList.add('open');
        mobileMenuOverlay?.classList.add('active');
        document.body.classList.add('mobile-menu-open');
    }

    function closeMobileMenu() {
        mobileMenu?.classList.remove('open');
        mobileMenuOverlay?.classList.remove('active');
        document.body.classList.remove('mobile-menu-open');
    }

    // Abrir menú
    mobileMenuBtn?.addEventListener('click', openMobileMenu);

    // Cerrar menú con botón X
    mobileMenuClose?.addEventListener('click', closeMobileMenu);

    // Cerrar menú al hacer clic en overlay
    mobileMenuOverlay?.addEventListener('click', closeMobileMenu);

    // Cerrar menú al hacer clic en un link de navegación
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    // Cerrar menú al hacer clic en el botón de agendar
    mobileAgendarBtn?.addEventListener('click', closeMobileMenu);

    // Logout desde móvil
    mobileLogoutBtn?.addEventListener('click', () => {
        closeMobileMenu();
        auth.handleLogout();
    });

    // Cerrar con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileMenu?.classList.contains('open')) {
            closeMobileMenu();
        }
    });

    // Actualizar visibilidad de la sección de usuario en móvil
    updateMobileUserSection();
}

/**
 * Actualiza la sección de usuario en el menú móvil
 */
export function updateMobileUserSection() {
    const mobileUserSection = document.getElementById('mobile-user-section');
    if (mobileUserSection) {
        if (state.currentUser) {
            mobileUserSection.classList.remove('hidden');
        } else {
            mobileUserSection.classList.add('hidden');
        }
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

    // Permitir enviar con Enter en el modal de login admin
    const adminUserInput = document.getElementById('admin-user');
    const adminPassInput = document.getElementById('admin-pass');
    const handleAdminEnter = (e) => {
        if (e.key === 'Enter') {
            auth.handleAdminLogin(adminUserInput?.value, adminPassInput?.value);
        }
    };
    adminUserInput?.addEventListener('keypress', handleAdminEnter);
    adminPassInput?.addEventListener('keypress', handleAdminEnter);

    // --- Lógica del Menú de Usuario ---
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
    const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');

    userMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenuDropdown.classList.toggle('open');
    });

    dropdownLogoutBtn?.addEventListener('click', auth.handleLogout);

    // Botón de editar perfil
    const editProfileBtn = document.getElementById('edit-profile-btn');
    editProfileBtn?.addEventListener('click', () => {
        userMenuDropdown?.classList.remove('open');
        auth.openProfileModal();
    });

    window.addEventListener('click', () => {
        if (userMenuDropdown?.classList.contains('open')) {
            userMenuDropdown.classList.remove('open');
        }
    });

    // --- Menú Móvil Hamburger ---
    setupMobileMenu();

    // --- Flujo de Reserva y Login/Registro de Cliente ---
    ui.clientLoginBtn?.addEventListener('click', async () => {
        const loginSuccess = await auth.handleClientLogin();
        if (loginSuccess) client.showBookingSummary();
    });
    ui.clientRegisterBtn?.addEventListener('click', async () => {
        const registerSuccess = await auth.handleClientRegister();
        if (registerSuccess) client.showBookingSummary();
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

        // Load data for specific tabs
        if (tabName === 'admin-barbers') {
            admin.renderBarbersList();
        } else if (tabName === 'admin-testimonials') {
            admin.renderTestimonialsList();
        }
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
                // Prevenir múltiples clics (race condition)
                if (confirmBtn.disabled || confirmBtn.dataset.processing === 'true') return;
                confirmBtn.dataset.processing = 'true';

                if (appointmentId) {
                    admin.handleDeleteAppointment(appointmentId, card, confirmBtn);
                }
            }
        }
    });

    // --- Listener para el botón de confirmar en el modal de bloqueo rápido ---
    document.getElementById('confirm-manual-booking-btn')?.addEventListener('click', async (e) => {
        const btn = e.target;

        // Prevenir múltiples clics (race condition)
        if (btn.disabled || btn.dataset.processing === 'true') return;
        btn.dataset.processing = 'true';

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
            btn.dataset.processing = 'false';
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
                colorControls.classList.remove('hidden');
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

    // --- Listener para refrescar citas del portal ---
    document.getElementById('refresh-appointments-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('refresh-appointments-btn');
        const icon = btn?.querySelector('.material-icons');
        if (icon) icon.style.animation = 'spin 1s linear infinite';

        try {
            await client.fetchAllAppointments();
            await client.renderUserPortal();
            ui.showToast('Citas actualizadas');
        } catch (error) {
            ui.showToast('Error al actualizar');
        } finally {
            if (icon) icon.style.animation = '';
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
    setupWizardListeners();
    admin.setupBarbersEventListeners();
    admin.setupTestimonialsEventListeners();
    auth.initProfileModal();

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
            router.navigate('inicio');
        });
    }

    // Actualizar año en el footer
    const currentYearEl = document.getElementById('current-year');
    if (currentYearEl) currentYearEl.textContent = new Date().getFullYear();

    // --- INICIALIZAR ROUTER SPA ---
    initRouter();

    // --- FIN DE LA LÓGICA DE NAVEGACIÓN ---
    try {
        await client.fetchSiteContent();
        client.renderPublicSite();
        ui.updateUIAfterLogin();

        // CAMBIO: El wizard ya NO se muestra automáticamente aquí
        // Solo se mostrará después de que el ADMIN inicie sesión (ver auth.js)
        // Si no está configurado, los visitantes ven la página pública con contenido por defecto

        if (state.currentUser?.role === 'ADMIN') {
            ui.showView('admin');
            await admin.renderAdminView();
        } else {
            ui.showView('client');
            await client.fetchAllAppointments();
            await client.renderUserPortal();
            client.renderClientCalendar();
        }

        // Manejar ruta inicial después de cargar contenido
        handleInitialRoute();

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

/**
 * Inicializa el router con las rutas de la aplicación
 */
function initRouter() {
    // Registrar todas las secciones navegables
    router.registerRoutes({
        '#inicio': { section: 'inicio', title: 'Inicio' },
        '#sobre': { section: 'sobre', title: 'Nosotros' },
        '#servicios': { section: 'servicios', title: 'Servicios' },
        '#galeria': { section: 'galeria', title: 'Galería' },
        '#testimonios': { section: 'testimonios', title: 'Reseñas' },
        '#ubicacion': { section: 'ubicacion', title: 'Ubicación' },
        '#agendar': { section: 'agendar', title: 'Agendar Cita' },
        '#user-portal-view': { section: 'user-portal-view', title: 'Mi Portal' }
    });

    // Escuchar cambios de ruta para actualizar título
    window.addEventListener('routeChanged', (e) => {
        const route = e.detail.route;
        const routeConfig = router.routes.get(route);
        if (routeConfig && state.siteContent?.business?.name) {
            document.title = `${routeConfig.title} | ${state.siteContent.business.name}`;
        }
    });
}

/**
 * Maneja la ruta inicial al cargar la página
 */
function handleInitialRoute() {
    const hash = window.location.hash;

    // Si hay un hash en la URL, navegar a esa sección
    if (hash && hash !== '#') {
        // Pequeño delay para asegurar que el contenido esté renderizado
        setTimeout(() => {
            router.navigate(hash);
        }, 100);
    }
}

/**
 * Muestra el wizard de configuración inicial
 */
function showSetupWizard() {
    const wizardModal = document.getElementById('setup-wizard-modal');
    if (wizardModal) {
        wizardModal.classList.remove('hidden');
    }
}

/**
 * Configura los event listeners del wizard de configuración
 */
function setupWizardListeners() {
    const wizardModal = document.getElementById('setup-wizard-modal');
    const step1 = document.getElementById('wizard-step-1');
    const step2 = document.getElementById('wizard-step-2');
    const stepSuccess = document.getElementById('wizard-step-success');

    const nextBtn = document.getElementById('wizard-next-btn');
    const backBtn = document.getElementById('wizard-back-btn');
    const finishBtn = document.getElementById('wizard-finish-btn');
    const closeBtn = document.getElementById('wizard-close-btn');

    // Paso 1 -> Paso 2
    nextBtn?.addEventListener('click', () => {
        const businessName = document.getElementById('wizard-business-name')?.value?.trim();

        if (!businessName || businessName.length < 2) {
            ui.showToast('Por favor, ingresa el nombre de tu negocio (mínimo 2 caracteres).');
            return;
        }

        step1?.classList.add('hidden');
        step2?.classList.remove('hidden');
    });

    // Paso 2 -> Paso 1
    backBtn?.addEventListener('click', () => {
        step2?.classList.add('hidden');
        step1?.classList.remove('hidden');
    });

    // Finalizar configuración
    finishBtn?.addEventListener('click', async () => {
        const businessName = document.getElementById('wizard-business-name')?.value?.trim();
        const phone = document.getElementById('wizard-phone')?.value?.trim();
        const whatsapp = document.getElementById('wizard-whatsapp')?.value?.trim();
        const instagram = document.getElementById('wizard-instagram')?.value?.trim();
        const facebook = document.getElementById('wizard-facebook')?.value?.trim();
        const tiktok = document.getElementById('wizard-tiktok')?.value?.trim();

        ui.setButtonLoadingState(finishBtn, true, 'Guardando...');

        try {
            // CAMBIO: Usar authFetch para enviar el token de autenticación del admin
            const response = await authFetch(`${API_BASE_URL}/content/setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessName,
                    businessPhone: phone,
                    businessWhatsApp: whatsapp,
                    socialInstagram: instagram,
                    socialFacebook: facebook,
                    socialTiktok: tiktok
                })
            });

            const result = await response.json();

            if (response.ok) {
                // Mostrar paso de éxito
                step2?.classList.add('hidden');
                stepSuccess?.classList.remove('hidden');

                // Actualizar el estado y re-renderizar
                state.siteContent.isConfigured = true;
                state.siteContent.business = {
                    name: businessName,
                    phone: phone || '',
                    whatsapp: whatsapp || '',
                    logo: ''
                };
                state.siteContent.social = {
                    instagram: instagram || '',
                    facebook: facebook || '',
                    tiktok: tiktok || ''
                };

                client.renderPublicSite();
            } else {
                ui.showToast(result.message || 'Error al guardar la configuración.');
            }
        } catch (error) {
            console.error('Error en configuración inicial:', error);
            ui.showToast('Error de conexión. Por favor, intenta de nuevo.');
        } finally {
            ui.setButtonLoadingState(finishBtn, false, 'Finalizar Configuración');
        }
    });

    // Cerrar wizard después de éxito
    closeBtn?.addEventListener('click', () => {
        wizardModal?.classList.add('hidden');
    });
}

// =======================================================
// === TOGGLE DARK/LIGHT MODE ===
// =======================================================

function setupThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');

    if (!themeToggleBtn || !themeIcon) return;

    // Cargar tema guardado o usar preferencia del sistema
    const savedTheme = localStorage.getItem('barber_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'dark'); // Default dark

    applyTheme(initialTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem('barber_theme', newTheme);
    });

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
        themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }
}

// =======================================================
// === BÚSQUEDA DE CITAS EN ADMIN ===
// =======================================================

function setupAppointmentSearch() {
    const searchInput = document.getElementById('search-appointments');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const inboxList = document.getElementById('inbox-list');

    if (!searchInput || !inboxList) return;

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            filterAppointments(e.target.value.toLowerCase().trim());
        }, 300);
    });

    searchClearBtn?.addEventListener('click', () => {
        searchInput.value = '';
        filterAppointments('');
        searchInput.focus();
    });

    // Permitir buscar con Enter
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            filterAppointments('');
        }
    });

    function filterAppointments(query) {
        const cards = inboxList.querySelectorAll('.admin-appointment-card');
        let visibleCount = 0;

        cards.forEach(card => {
            const clientName = card.querySelector('.appointment-details strong')?.textContent?.toLowerCase() || '';
            const serviceName = card.querySelector('.appointment-details span')?.textContent?.toLowerCase() || '';
            const dateTime = card.querySelector('.text-sm')?.textContent?.toLowerCase() || '';

            const matches = clientName.includes(query) ||
                           serviceName.includes(query) ||
                           dateTime.includes(query);

            if (matches || query === '') {
                card.style.display = '';
                visibleCount++;

                // Highlight del texto buscado
                if (query) {
                    highlightText(card, query);
                } else {
                    removeHighlight(card);
                }
            } else {
                card.style.display = 'none';
            }
        });

        // Mostrar mensaje si no hay resultados
        const noResultsEl = inboxList.querySelector('.no-results');
        if (visibleCount === 0 && query !== '') {
            if (!noResultsEl) {
                const noResults = document.createElement('div');
                noResults.className = 'no-results';
                noResults.innerHTML = `
                    <span class="material-icons">search_off</span>
                    <p>No se encontraron citas para "${escapeHtml(query)}"</p>
                `;
                inboxList.appendChild(noResults);
            }
        } else if (noResultsEl) {
            noResultsEl.remove();
        }
    }

    function highlightText(card, query) {
        // Restaurar texto original primero
        removeHighlight(card);

        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
            const text = node.textContent;
            const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
            if (regex.test(text)) {
                const span = document.createElement('span');
                span.innerHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
                node.parentNode.replaceChild(span, node);
            }
        });
    }

    function removeHighlight(card) {
        const highlights = card.querySelectorAll('.search-highlight');
        highlights.forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize();
        });
        // Limpiar spans vacíos
        card.querySelectorAll('span:empty').forEach(s => s.remove());
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// =======================================================
// === NAVEGACIÓN POR TECLADO MEJORADA ===
// =======================================================

function setupKeyboardNavigation() {
    // Cerrar modales con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            ui.closeAllModals();
        }
    });

    // Hacer gallery items navegables con teclado
    document.getElementById('gallery-container')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const item = e.target.closest('.gallery-item');
            if (item) {
                e.preventDefault();
                item.click();
            }
        }
    });

    // Hacer calendar days navegables con teclado
    document.querySelectorAll('.calendar-grid').forEach(grid => {
        grid.addEventListener('keydown', (e) => {
            const day = e.target.closest('.calendar-day:not(.empty)');
            if (!day) return;

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                day.click();
            }

            // Navegación con flechas
            const days = Array.from(grid.querySelectorAll('.calendar-day:not(.empty)'));
            const currentIndex = days.indexOf(day);

            let nextIndex;
            switch (e.key) {
                case 'ArrowRight':
                    nextIndex = currentIndex + 1;
                    break;
                case 'ArrowLeft':
                    nextIndex = currentIndex - 1;
                    break;
                case 'ArrowDown':
                    nextIndex = currentIndex + 7;
                    break;
                case 'ArrowUp':
                    nextIndex = currentIndex - 7;
                    break;
                default:
                    return;
            }

            if (nextIndex >= 0 && nextIndex < days.length) {
                e.preventDefault();
                days[nextIndex].focus();
            }
        });
    });

    // Time slots navegables con teclado
    document.getElementById('time-slots-container')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const slot = e.target.closest('.time-slot.available');
            if (slot) {
                e.preventDefault();
                slot.click();
            }
        }
    });
}

// Punto de entrada de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupThemeToggle();
    setupAppointmentSearch();
    setupKeyboardNavigation();
});