// --- src/config/database.js ---
import { PrismaClient } from '@prisma/client';

// Configure Prisma with logging in development
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error']
});

/**
 * Connect to database with retry logic
 * @param {number} maxRetries - Maximum number of connection attempts
 * @param {number} retryDelay - Delay between retries in milliseconds
 *
 * DISPARADORES EN TERMINAL:
 * - "✅ Database connected successfully" -> Conexión exitosa a la base de datos
 * - "❌ Database connection attempt X/Y failed" -> Fallo en intento de conexión
 * - "Retrying in X seconds..." -> Reintentando conexión
 * - "❌ All database connection attempts failed" -> Todos los intentos fallaron
 */
export async function connectDatabase(maxRetries = 3, retryDelay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await prisma.$connect();
            // DISPARADOR: Indica que la conexión a la base de datos fue exitosa
            console.log('✅ Database connected successfully');
            return true;
        } catch (error) {
            // DISPARADOR: Muestra el número de intento fallido y el mensaje de error
            console.error(`❌ Database connection attempt ${attempt}/${maxRetries} failed:`, error.message);

            if (attempt < maxRetries) {
                // DISPARADOR: Informa que se reintentará la conexión
                console.log(`   Retrying in ${retryDelay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }

    // DISPARADOR: Indica que no se pudo conectar después de todos los intentos
    console.error('❌ All database connection attempts failed');
    return false;
}

/**
 * Disconnect from database gracefully
 *
 * DISPARADOR EN TERMINAL:
 * - "Database disconnected" -> La base de datos se desconectó correctamente
 */
export async function disconnectDatabase() {
    await prisma.$disconnect();
    // DISPARADOR: Confirma que la base de datos fue desconectada
    console.log('Database disconnected');
}

/**
 * Health check for database
 * @returns {Promise<boolean>}
 */
export async function isDatabaseHealthy() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
}

export { prisma };
export default prisma;
