// --- tests/integration.test.js ---
// Pruebas de integración: Web + API + Cloudinary
// Ejecutan contra la API de producción en Railway

const API_URL = 'https://zenturia-api-production.up.railway.app';

describe('API Integration Tests - Production', () => {

    // ============ HEALTH CHECK ============
    describe('Health Check', () => {
        test('GET /health - should return OK status', async () => {
            const response = await fetch(`${API_URL}/health`);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe('ok');
            expect(data.timestamp).toBeDefined();
        });
    });

    // ============ GALLERY FLOW (Cloudinary Integration) ============
    describe('Gallery Flow - Cloudinary Integration', () => {
        test('GET /gallery - should return gallery images', async () => {
            const response = await fetch(`${API_URL}/gallery`);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(Array.isArray(data.images)).toBe(true);

            // Verificar que las URLs son de Cloudinary si hay imágenes
            if (data.images.length > 0) {
                const image = data.images[0];
                expect(image.id).toBeDefined();
                expect(image.url).toBeDefined();
                expect(image.url).toMatch(/cloudinary\.com|res\.cloudinary\.com/);
            }
        });

        test('POST /gallery/images - should require admin auth', async () => {
            const response = await fetch(`${API_URL}/gallery/images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://example.com/test.jpg', altText: 'Test' })
            });

            expect(response.status).toBe(401);
        });
    });

    // ============ HAIRCUTS FLOW (Catálogo de Cortes) ============
    describe('Haircuts Flow - Cloudinary Integration', () => {
        test('GET /haircuts - should return haircuts catalog', async () => {
            const response = await fetch(`${API_URL}/haircuts`);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(Array.isArray(data.haircuts)).toBe(true);

            // Verificar estructura si hay cortes
            if (data.haircuts.length > 0) {
                const haircut = data.haircuts[0];
                expect(haircut.id).toBeDefined();
                expect(haircut.name).toBeDefined();
                expect(haircut.imageUrl).toBeDefined();
                expect(haircut.imageUrl).toMatch(/cloudinary\.com|res\.cloudinary\.com/);
            }
        });

        test('POST /haircuts - should require admin auth', async () => {
            const response = await fetch(`${API_URL}/haircuts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test Haircut' })
            });

            expect(response.status).toBe(401);
        });

        test('DELETE /haircuts/:id - should require admin auth', async () => {
            const response = await fetch(`${API_URL}/haircuts/some-id`, {
                method: 'DELETE'
            });

            expect(response.status).toBe(401);
        });
    });

    // ============ SERVICES FLOW ============
    describe('Services Flow', () => {
        test('GET /content/services - should return services list', async () => {
            const response = await fetch(`${API_URL}/content/services`);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(Array.isArray(data.services)).toBe(true);

            // Verificar estructura si hay servicios
            if (data.services.length > 0) {
                const service = data.services[0];
                expect(service.id).toBeDefined();
                expect(service.name).toBeDefined();
                expect(service.price).toBeDefined();
            }
        });
    });

    // ============ BARBERS FLOW ============
    describe('Barbers Flow', () => {
        test('GET /barbers - should return barbers list', async () => {
            const response = await fetch(`${API_URL}/barbers`);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(Array.isArray(data.barbers)).toBe(true);
        });
    });

    // ============ AUTH FLOW ============
    describe('Auth Flow', () => {
        test('GET /me - should reject without token', async () => {
            const response = await fetch(`${API_URL}/me`);

            expect(response.status).toBe(401);
        });

        test('POST /login/client - should reject invalid credentials', async () => {
            const response = await fetch(`${API_URL}/login/client`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'invalid@test.com',
                    password: 'wrongpassword'
                })
            });
            const data = await response.json();

            expect(data.success).toBe(false);
        });
    });
});
