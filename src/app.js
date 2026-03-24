// --- src/app.js ---
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Config
import { config, validateEnv } from './config/index.js';
import { connectDatabase } from './config/database.js';
import { corsOptions } from './config/cors.js';

// Middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';

// Routes
import routes from './routes/index.js';

// Services
import { initializeTransporter } from './services/email.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
console.log('│                  📄 DISPARADORES DE app.js                         │');
console.log('├───────┬───────────────────────────┬────────────────────────────────┤');
console.log('│ LÍNEA │ DISPARADOR                │ DESCRIPCIÓN                    │');
console.log('├───────┼───────────────────────────┼────────────────────────────────┤');
console.log('│  49   │ cors(corsOptions)         │ Configura CORS                 │');
console.log('│  53   │ generalLimiter            │ Rate limiting                  │');
console.log('│  57   │ express.json()            │ Parser JSON                    │');
console.log('│  62   │ express.static(public)    │ Archivos estáticos             │');
console.log('│  67   │ express.static(uploads)   │ Carpeta uploads                │');
console.log('│  71   │ routes                    │ Rutas API                      │');
console.log('│  75   │ notFoundHandler           │ Manejador 404                  │');
console.log('│  79   │ errorHandler              │ Manejador de errores           │');
console.log('│  83   │ initializeTransporter()   │ Servicio de email              │');
console.log('│  96   │ validateEnv()             │ Valida variables .env          │');
console.log('│ 100   │ connectDatabase()         │ Conexión a base de datos       │');
console.log('│ 103   │ app.listen()              │ Inicia el servidor             │');
console.log('└───────┴───────────────────────────┴────────────────────────────────┘');

console.log('\n📦 Iniciando configuración del servidor...\n');

// CORS configuration
app.use(cors(corsOptions));
console.log('   ✅ CORS configurado');

// Rate limiting (general)
app.use(generalLimiter);
console.log('   ✅ Rate Limiter activado');

// Parse JSON
app.use(express.json());
console.log('   ✅ Parser JSON habilitado');

// Static files
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));
console.log(`   ✅ Archivos estáticos: ${publicPath}`);

// Serve bar.html as the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'bar.html'));
});

// Uploads folder
const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));
console.log(`   ✅ Carpeta uploads: ${uploadsPath}`);

// API routes
app.use('/', routes);
console.log('   ✅ Rutas API montadas');

// 404 handler (for unmatched routes)
app.use(notFoundHandler);
console.log('   ✅ Manejador 404 configurado');

// Global error handler (must be last)
app.use(errorHandler);
console.log('   ✅ Manejador de errores global configurado');

// Initialize email service
initializeTransporter();
console.log('   ✅ Servicio de email inicializado');

/**
 * Start the server
 *
 * DISPARADORES EN TERMINAL:
 * - "🚀 Server running on http://localhost:PORT" -> Servidor iniciado correctamente
 * - "Environment: X" -> Muestra el entorno actual (development/production)
 * - "Database: Connected/Not connected" -> Estado de la conexión a la base de datos
 */
export async function startServer() {
    console.log('\n🔧 Validando variables de entorno...');
    validateEnv();
    console.log('   ✅ Variables de entorno validadas');

    console.log('\n🗄️  Conectando a la base de datos...');
    const dbConnected = await connectDatabase();
    console.log(`   ${dbConnected ? '✅ Base de datos conectada' : '❌ Error al conectar base de datos'}`);

    const server = app.listen(config.port, () => {
        console.log('\n════════════════════════════════════════════════════════');
        console.log('   🚀 SERVIDOR INICIADO CORRECTAMENTE');
        console.log('════════════════════════════════════════════════════════');
        console.log(`   🌐 URL:         http://localhost:${config.port}`);
        console.log(`   🔹 Entorno:     ${config.nodeEnv}`);
        console.log(`   🗄️  Database:   ${dbConnected ? '✅ Conectada' : '❌ No conectada'}`);
        console.log('════════════════════════════════════════════════════════\n');
    });

    return server;
}

export default app;
