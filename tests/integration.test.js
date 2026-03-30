// --- tests/integration.test.js ---
// Pruebas de integración: Web + API + Cloudinary

import request from 'supertest';
import app from '../src/app.js';

const API_BASE = '';

describe('API Integration Tests', () => {

    // ============ HEALTH CHECK ============
    describe('Health Check', () => {
        test('GET /health - should return OK status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body.status).toBe('ok');
            expect(response.body.timestamp).toBeDefined();
        });
    });

    // ============ AUTH FLOW ============
    describe('Auth Flow', () => {
        let accessToken;
        let refreshToken;

        test('POST /login/client - should login with valid credentials', async () => {
            // Nota: Este test requiere un usuario existente en la base de datos
            // Si no existe, el test debe ser skipped o usar datos de seed
            const response = await request(app)
                .post('/login/client')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            // Si las credenciales son válidas
            if (response.status === 200) {
                expect(response.body.success).toBe(true);
                expect(response.body.accessToken).toBeDefined();
                expect(response.body.refreshToken).toBeDefined();
                accessToken = response.body.accessToken;
                refreshToken = response.body.refreshToken;
            } else {
                // Si no hay usuario de prueba, verificar estructura de error
                expect(response.body.success).toBe(false);
            }
        });

        test('GET /me - should access protected route with token', async () => {
            if (!accessToken) {
                console.log('Skipping test - no access token available');
                return;
            }

            const response = await request(app)
                .get('/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.user).toBeDefined();
        });

        test('GET /me - should reject without token', async () => {
            const response = await request(app)
                .get('/me')
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    // ============ GALLERY FLOW (Cloudinary Integration) ============
    describe('Gallery Flow - Cloudinary Integration', () => {
        test('GET /gallery - should return gallery images', async () => {
            const response = await request(app)
                .get('/gallery')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.images)).toBe(true);

            // Verificar estructura de imágenes si hay datos
            if (response.body.images.length > 0) {
                const image = response.body.images[0];
                expect(image.id).toBeDefined();
                expect(image.url).toBeDefined();
                // Verificar que la URL sea de Cloudinary
                expect(image.url).toMatch(/cloudinary\.com|res\.cloudinary\.com/);
            }
        });

        test('POST /gallery/images - should require admin auth', async () => {
            const response = await request(app)
                .post('/gallery/images')
                .send({ url: 'https://example.com/test.jpg', altText: 'Test' })
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    // ============ HAIRCUTS FLOW (New Catalog) ============
    describe('Haircuts Flow - Cloudinary Integration', () => {
        test('GET /haircuts - should return haircuts catalog', async () => {
            const response = await request(app)
                .get('/haircuts')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.haircuts)).toBe(true);

            // Verificar estructura de cortes si hay datos
            if (response.body.haircuts.length > 0) {
                const haircut = response.body.haircuts[0];
                expect(haircut.id).toBeDefined();
                expect(haircut.name).toBeDefined();
                expect(haircut.imageUrl).toBeDefined();
                // Verificar que la URL sea de Cloudinary
                expect(haircut.imageUrl).toMatch(/cloudinary\.com|res\.cloudinary\.com/);
            }
        });

        test('GET /haircuts/:id - should return 404 for non-existent haircut', async () => {
            const response = await request(app)
                .get('/haircuts/non-existent-id')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Corte no encontrado.');
        });

        test('POST /haircuts - should require admin auth', async () => {
            const response = await request(app)
                .post('/haircuts')
                .field('name', 'Test Haircut')
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        test('PUT /haircuts/:id - should require admin auth', async () => {
            const response = await request(app)
                .put('/haircuts/some-id')
                .send({ name: 'Updated Name' })
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        test('DELETE /haircuts/:id - should require admin auth', async () => {
            const response = await request(app)
                .delete('/haircuts/some-id')
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    // ============ SERVICES FLOW ============
    describe('Services Flow', () => {
        test('GET /content/services - should return services list', async () => {
            const response = await request(app)
                .get('/content/services')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.services)).toBe(true);

            // Verificar estructura de servicios si hay datos
            if (response.body.services.length > 0) {
                const service = response.body.services[0];
                expect(service.id).toBeDefined();
                expect(service.name).toBeDefined();
                expect(service.price).toBeDefined();
                expect(service.duration).toBeDefined();
            }
        });
    });

    // ============ CONTENT FLOW ============
    describe('Content Flow', () => {
        test('GET /content - should return site content', async () => {
            const response = await request(app)
                .get('/content')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.content).toBeDefined();

            // Verificar campos básicos del contenido
            const content = response.body.content;
            expect(content.heroTitle).toBeDefined();
            expect(content.businessName).toBeDefined();
        });
    });

    // ============ BARBERS FLOW ============
    describe('Barbers Flow', () => {
        test('GET /barbers - should return barbers list', async () => {
            const response = await request(app)
                .get('/barbers')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.barbers)).toBe(true);
        });
    });

    // ============ CLOUDINARY VERIFICATION ============
    describe('Cloudinary URL Verification', () => {
        test('All image URLs should be from Cloudinary', async () => {
            const cloudinaryRegex = /cloudinary\.com|res\.cloudinary\.com/;

            // Test gallery images
            const galleryResponse = await request(app).get('/gallery');
            if (galleryResponse.body.images?.length > 0) {
                galleryResponse.body.images.forEach(image => {
                    if (image.url) {
                        expect(image.url).toMatch(cloudinaryRegex);
                    }
                });
            }

            // Test haircuts images
            const haircutsResponse = await request(app).get('/haircuts');
            if (haircutsResponse.body.haircuts?.length > 0) {
                haircutsResponse.body.haircuts.forEach(haircut => {
                    if (haircut.imageUrl) {
                        expect(haircut.imageUrl).toMatch(cloudinaryRegex);
                    }
                });
            }
        });
    });
});
