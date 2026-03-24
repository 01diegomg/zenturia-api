// =======================================================
//         SISTEMA DE RUTAS HASH (SPA ROUTER)
// =======================================================

/**
 * Router para Single Page Application con hash routing
 * Mantiene la posición al recargar y permite navegación fluida
 */

class HashRouter {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.scrollPositions = {};
        this.isNavigating = false;

        // Inicializar
        this.init();
    }

    init() {
        // Escuchar cambios de hash
        window.addEventListener('hashchange', () => this.handleRouteChange());

        // Manejar la carga inicial
        window.addEventListener('DOMContentLoaded', () => {
            this.handleRouteChange();
        });

        // Guardar posición de scroll antes de salir
        window.addEventListener('beforeunload', () => {
            this.saveScrollPosition();
        });

        // Guardar posición de scroll periódicamente
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.saveCurrentScrollPosition();
            }, 100);
        }, { passive: true });
    }

    /**
     * Registra las rutas disponibles
     * @param {Object} routeConfig - Configuración de rutas {hash: elementId}
     */
    registerRoutes(routeConfig) {
        for (const [hash, config] of Object.entries(routeConfig)) {
            this.routes.set(hash, config);
        }
    }

    /**
     * Maneja el cambio de ruta
     */
    handleRouteChange() {
        const hash = window.location.hash || '#inicio';
        const cleanHash = hash.split('?')[0]; // Remover query params si hay

        // Guardar posición anterior
        if (this.currentRoute) {
            this.saveScrollPosition();
        }

        this.currentRoute = cleanHash;

        // Intentar restaurar posición guardada
        const savedPosition = this.getSavedScrollPosition(cleanHash);

        // Navegar al elemento
        this.navigateToSection(cleanHash, savedPosition);

        // Actualizar navegación activa
        this.updateActiveNav(cleanHash);

        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('routeChanged', {
            detail: { route: cleanHash }
        }));
    }

    /**
     * Navega a una sección específica
     * @param {string} hash - El hash de la sección
     * @param {number|null} savedPosition - Posición guardada del scroll
     */
    navigateToSection(hash, savedPosition = null) {
        const elementId = hash.replace('#', '');
        const element = document.getElementById(elementId);

        if (!element) {
            console.warn(`Sección no encontrada: ${elementId}`);
            return;
        }

        this.isNavigating = true;

        // Si hay posición guardada, usarla
        if (savedPosition !== null && savedPosition > 0) {
            window.scrollTo({
                top: savedPosition,
                behavior: 'instant'
            });
        } else {
            // Calcular offset para el header fijo
            const header = document.querySelector('header');
            const headerHeight = header ? header.offsetHeight : 0;
            const topBar = document.getElementById('top-bar');
            const topBarHeight = topBar && !topBar.classList.contains('top-bar-hidden') ? topBar.offsetHeight : 0;
            const totalOffset = headerHeight + topBarHeight + 20;

            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;

            window.scrollTo({
                top: elementPosition - totalOffset,
                behavior: 'smooth'
            });
        }

        // Marcar navegación como completada después de un delay
        setTimeout(() => {
            this.isNavigating = false;
        }, 500);
    }

    /**
     * Actualiza el enlace de navegación activo
     * @param {string} hash - El hash actual
     */
    updateActiveNav(hash) {
        // Actualizar navegación principal
        document.querySelectorAll('.main-nav-link, .mobile-nav-link').forEach(link => {
            const linkHash = link.getAttribute('href');
            link.classList.toggle('nav-link-active', linkHash === hash);
        });
    }

    /**
     * Guarda la posición actual del scroll
     */
    saveCurrentScrollPosition() {
        if (this.currentRoute && !this.isNavigating) {
            this.scrollPositions[this.currentRoute] = window.pageYOffset;
            this.persistScrollPositions();
        }
    }

    /**
     * Guarda la posición de scroll antes de cambiar de ruta
     */
    saveScrollPosition() {
        if (this.currentRoute) {
            this.scrollPositions[this.currentRoute] = window.pageYOffset;
            this.persistScrollPositions();
        }
    }

    /**
     * Obtiene la posición guardada para una ruta
     * @param {string} hash - El hash de la ruta
     * @returns {number|null}
     */
    getSavedScrollPosition(hash) {
        // Primero intentar desde memoria
        if (this.scrollPositions[hash] !== undefined) {
            return this.scrollPositions[hash];
        }

        // Luego desde sessionStorage
        try {
            const stored = sessionStorage.getItem('barber_scroll_positions');
            if (stored) {
                const positions = JSON.parse(stored);
                return positions[hash] || null;
            }
        } catch (e) {
            console.warn('Error al leer posiciones de scroll:', e);
        }

        return null;
    }

    /**
     * Persiste las posiciones de scroll en sessionStorage
     */
    persistScrollPositions() {
        try {
            sessionStorage.setItem('barber_scroll_positions', JSON.stringify(this.scrollPositions));
        } catch (e) {
            console.warn('Error al guardar posiciones de scroll:', e);
        }
    }

    /**
     * Navega a una ruta específica
     * @param {string} hash - El hash destino
     * @param {boolean} smooth - Si usar scroll suave
     */
    navigate(hash, smooth = true) {
        if (!hash.startsWith('#')) {
            hash = '#' + hash;
        }

        // Actualizar el hash (esto dispara hashchange)
        if (window.location.hash !== hash) {
            window.location.hash = hash;
        } else {
            // Si ya estamos en la misma ruta, forzar navegación
            this.handleRouteChange();
        }
    }

    /**
     * Obtiene la ruta actual
     * @returns {string}
     */
    getCurrentRoute() {
        return this.currentRoute || window.location.hash || '#inicio';
    }
}

// Crear instancia global del router
const router = new HashRouter();

// Exportar para uso en módulos
export default router;
export { router };
