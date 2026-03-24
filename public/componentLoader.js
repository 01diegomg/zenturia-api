// --- componentLoader.js ---
// Sistema de carga de componentes HTML

/**
 * Carga un componente HTML y lo inserta en un contenedor
 * @param {string} componentPath - Ruta al archivo HTML del componente
 * @param {string|HTMLElement} container - Selector CSS o elemento donde insertar
 * @param {string} [position='beforeend'] - Posición de inserción (beforeend, afterbegin, etc.)
 * @returns {Promise<void>}
 */
export async function loadComponent(componentPath, container, position = 'beforeend') {
    try {
        const response = await fetch(componentPath);
        if (!response.ok) {
            throw new Error(`Error al cargar componente: ${componentPath}`);
        }
        const html = await response.text();

        const targetElement = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!targetElement) {
            console.warn(`Contenedor no encontrado: ${container}`);
            return;
        }

        targetElement.insertAdjacentHTML(position, html);
    } catch (error) {
        console.error(`Error cargando componente ${componentPath}:`, error);
    }
}

/**
 * Carga múltiples componentes en paralelo
 * @param {Array<{path: string, container: string, position?: string}>} components
 * @returns {Promise<void>}
 */
export async function loadComponents(components) {
    await Promise.all(
        components.map(({ path, container, position }) =>
            loadComponent(path, container, position)
        )
    );
}

/**
 * Carga todos los componentes de la aplicación
 * Esta función debe llamarse antes de inicializar la aplicación
 * @returns {Promise<void>}
 */
export async function loadAllComponents() {
    // Definir todos los componentes a cargar
    const components = [
        // Header
        { path: 'components/header.html', container: '#app-container', position: 'afterbegin' },

        // Secciones del cliente (dentro de #client-main-view)
        { path: 'components/client-hero.html', container: '#client-sections-container', position: 'beforeend' },
        { path: 'components/client-about.html', container: '#client-sections-container', position: 'beforeend' },
        { path: 'components/client-services.html', container: '#client-sections-container', position: 'beforeend' },
        { path: 'components/client-gallery.html', container: '#client-sections-container', position: 'beforeend' },
        { path: 'components/client-testimonials.html', container: '#client-sections-container', position: 'beforeend' },
        { path: 'components/client-location.html', container: '#client-sections-container', position: 'beforeend' },
        { path: 'components/client-booking.html', container: '#client-sections-container', position: 'beforeend' },
        { path: 'components/client-portal.html', container: '#client-sections-container', position: 'beforeend' },
        { path: 'components/footer.html', container: '#client-sections-container', position: 'beforeend' },

        // Panel de administración
        { path: 'components/admin-header.html', container: '#admin-tabs-container', position: 'beforeend' },
        { path: 'components/admin/appointments-tab.html', container: '#admin-content-container', position: 'beforeend' },
        { path: 'components/admin/sales-tab.html', container: '#admin-content-container', position: 'beforeend' },
        { path: 'components/admin/content-tab.html', container: '#admin-content-container', position: 'beforeend' },
        { path: 'components/admin/schedule-tab.html', container: '#admin-content-container', position: 'beforeend' },

        // Modales
        { path: 'components/modals/admin-login-modal.html', container: '#modals-container', position: 'beforeend' },
        { path: 'components/modals/booking-modal.html', container: '#modals-container', position: 'beforeend' },
        { path: 'components/modals/admin-day-modal.html', container: '#modals-container', position: 'beforeend' },
        { path: 'components/modals/service-editor-modal.html', container: '#modals-container', position: 'beforeend' },
        { path: 'components/modals/manual-booking-modal.html', container: '#modals-container', position: 'beforeend' },
        { path: 'components/modals/gallery-editor-modal.html', container: '#modals-container', position: 'beforeend' },
        { path: 'components/modals/override-editor-modal.html', container: '#modals-container', position: 'beforeend' },
        { path: 'components/modals/gallery-lightbox-modal.html', container: '#modals-container', position: 'beforeend' },
        { path: 'components/modals/setup-wizard-modal.html', container: '#modals-container', position: 'beforeend' },

        // Elementos flotantes
        { path: 'components/floating-elements.html', container: 'body', position: 'beforeend' },
    ];

    // Cargar componentes en orden para mantener la estructura
    for (const component of components) {
        await loadComponent(component.path, component.container, component.position);
    }

    console.log('Todos los componentes cargados correctamente');
}

/**
 * Inicializa la carga de componentes cuando el DOM está listo
 */
export function initComponentLoader() {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', async () => {
                await loadAllComponents();
                resolve();
            });
        } else {
            loadAllComponents().then(resolve);
        }
    });
}
