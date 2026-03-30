// tests/setup.js
// Configuración inicial para los tests de integración

import 'dotenv/config';

// Establecer timeout global para tests
jest.setTimeout(30000);

// Silenciar logs durante los tests
beforeAll(() => {
    // Guardar console.log original
    global.originalConsoleLog = console.log;
    global.originalConsoleError = console.error;

    // Silenciar logs durante tests (opcional, comentar para debug)
    console.log = () => {};
    console.error = () => {};
});

afterAll(() => {
    // Restaurar console.log original
    console.log = global.originalConsoleLog;
    console.error = global.originalConsoleError;
});
