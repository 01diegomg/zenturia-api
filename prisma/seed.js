// prisma/seed.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Generate a random password
 * @param {number} length - Password length
 * @returns {string} Random password
 */
function generateRandomPassword(length = 16) {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
}

async function main() {
    console.log('Start seeding ...');

    // Clean existing data
    await prisma.refreshToken.deleteMany().catch(() => {});
    await prisma.appointment.deleteMany().catch(() => {});
    await prisma.galleryImage.deleteMany().catch(() => {});
    await prisma.scheduleOverride.deleteMany().catch(() => {});
    await prisma.barberScheduleOverride.deleteMany().catch(() => {});
    await prisma.barberSchedule.deleteMany().catch(() => {});
    await prisma.barber.deleteMany().catch(() => {});
    await prisma.testimonial.deleteMany().catch(() => {});
    await prisma.service.deleteMany().catch(() => {});
    await prisma.user.deleteMany().catch(() => {});
    await prisma.workSchedule.deleteMany().catch(() => {});
    await prisma.siteContent.deleteMany().catch(() => {});
    console.log('Previous data cleaned.');

    // Create site content
    await prisma.siteContent.create({
        data: {
            id: 'main',
            heroTitle: "Estilo & Precisión",
            heroSubtitle: "La experiencia de barbería clásica para el hombre moderno.",
            aboutText: "<p class='text-lg text-gray-300 mb-4'>En nuestra barbería, no solo cortamos cabello, creamos experiencias donde la tradición y la modernidad se encuentran. Nuestro equipo de barberos expertos se dedica a perfeccionar tu estilo con una precisión inigualable.</p><p class='text-lg text-gray-300'>Utilizamos solo los mejores productos y técnicas para asegurar que salgas luciendo y sintiéndote impecable. Tu estilo es nuestra firma.</p>",
            aboutImage: "https://images.unsplash.com/photo-1621607512214-6c349036a732?q=80&w=1974&auto=format&fit=crop",
            heroBackgroundType: 'IMAGE',
            heroBackgroundValue: "https://images.unsplash.com/photo-1599351431202-1e5e263ce727?q=80&w=2070&auto=format&fit=crop",
            locationAddress: "Plaza de la Constitución S/N<br>Centro, 43600<br>Tulancingo de Bravo, Hidalgo",
            locationSchedule: "Lunes a Sábado<br>9:00 AM - 7:00 PM<br>Domingo: Cerrado",
            locationMapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3746.8847899414!2d-98.36067612373657!3d20.084444981302946!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85d0a45c3b03c097%3A0x5c7c0e54d0a97c62!2sPlaza%20de%20la%20Constituci%C3%B3n%2C%20Centro%2C%2043600%20Tulancingo%20de%20Bravo%2C%20Hgo.!5e0!3m2!1ses!2smx!4v1704067200000!5m2!1ses!2smx",
            colorAccent: "#CFAF7C",
            colorBackground: "#0a0a0a",
            colorTextMain: "#FFFFFF",
            colorTextSubtle: "#cccccc",
            // Configuración del negocio
            businessName: "Mi Barbería",
            businessLogo: "",
            businessPhone: "",
            businessWhatsApp: "",
            // Redes sociales
            socialInstagram: "",
            socialFacebook: "",
            socialTiktok: "",
            // Estado de configuración (false = mostrará wizard)
            isConfigured: false,
        }
    });
    console.log('Site content created.');

    // Create default work schedule
    const defaultSchedule = Array.from({ length: 7 }, (_, i) => {
        const isOff = i === 0; // Sunday closed
        const hours = isOff ? [] : [{ start: "09:00", end: "18:00" }];
        return {
            dayOfWeek: i,
            workingHours: JSON.stringify(hours),
            isDayOff: isOff
        };
    });
    await prisma.workSchedule.createMany({ data: defaultSchedule });
    console.log('Default schedule created.');

    // Create sample services
    await prisma.service.createMany({
        data: [
            { id: "s1", name: "Corte Clásico de Caballero", description: "Un corte de precisión adaptado a tu estilo.", price: 350, duration: 45 },
            { id: "s2", name: "Afeitado Premium con Toalla Caliente", description: "La experiencia de afeitado definitiva.", price: 400, duration: 60 },
            { id: "s3", name: "Diseño y Perfilado de Barba", description: "Dale forma y definición a tu barba.", price: 250, duration: 30 }
        ]
    });
    console.log('Services created.');

    // Create default barber
    const defaultBarber = await prisma.barber.create({
        data: {
            id: "barber1",
            name: "Carlos Rodríguez",
            photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop",
            specialties: JSON.stringify(["s1", "s2", "s3"]),
            isActive: true
        }
    });
    console.log('Default barber created.');

    // Create barber schedule (same as business schedule)
    const barberSchedule = Array.from({ length: 7 }, (_, i) => {
        const isOff = i === 0; // Sunday closed
        const hours = isOff ? [] : [{ start: "09:00", end: "18:00" }];
        return {
            barberId: defaultBarber.id,
            dayOfWeek: i,
            workingHours: JSON.stringify(hours),
            isDayOff: isOff
        };
    });
    await prisma.barberSchedule.createMany({ data: barberSchedule });
    console.log('Barber schedule created.');

    // Create sample testimonials
    await prisma.testimonial.createMany({
        data: [
            {
                name: "Roberto Martínez",
                rating: 5,
                text: "Excelente servicio, el mejor corte que he tenido. El ambiente es muy profesional y los barberos saben lo que hacen.",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop",
                verified: true,
                isActive: true
            },
            {
                name: "Miguel Ángel López",
                rating: 5,
                text: "Llevo más de un año viniendo aquí y nunca me han decepcionado. El afeitado premium es una experiencia increíble.",
                avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=100&auto=format&fit=crop",
                verified: true,
                isActive: true
            },
            {
                name: "Fernando García",
                rating: 5,
                text: "Muy recomendado. El diseño de barba quedó exactamente como lo quería. Volveré sin duda.",
                avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&auto=format&fit=crop",
                verified: false,
                isActive: true
            }
        ]
    });
    console.log('Sample testimonials created.');

    // --- User creation with secure passwords ---
    const saltRounds = 10;

    // Admin user - use environment variable or default password
    const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@barberia.com';
    const adminPasswordPlain = process.env.ADMIN_SEED_PASSWORD || 'admin123';
    const adminPassword = await bcrypt.hash(adminPasswordPlain, saltRounds);

    await prisma.user.create({
        data: {
            email: adminEmail,
            name: 'Admin',
            password: adminPassword,
            role: 'ADMIN',
        },
    });

    // Only show password in development
    if (process.env.NODE_ENV !== 'production') {
        console.log('\n========================================');
        console.log('ADMIN USER CREATED:');
        console.log(`  Email: ${adminEmail}`);
        console.log(`  Password: ${adminPasswordPlain}`);
        console.log('========================================\n');
        console.log('IMPORTANT: Change this password immediately in production!');
    } else {
        console.log('Admin user created. Check your environment variables for credentials.');
    }

    // Sample client user (development only)
    if (process.env.NODE_ENV !== 'production') {
        const clientPassword = await bcrypt.hash('demo123', saltRounds);
        await prisma.user.create({
            data: {
                email: 'cliente@ejemplo.com',
                name: 'Juan Cliente',
                password: clientPassword,
                role: 'CLIENT',
            },
        });
        console.log('Sample client user created (cliente@ejemplo.com / demo123)');
    }

    // Walk-in user for manual bookings
    const walkinPassword = await bcrypt.hash(generateRandomPassword(), saltRounds);
    await prisma.user.create({
        data: {
            email: 'walkin@barberia.com',
            name: 'Cliente Presencial',
            password: walkinPassword,
            role: 'CLIENT',
        },
    });
    console.log('Walk-in user created.');

    console.log('\nSeeding finished successfully!');
}

main()
    .catch((e) => {
        console.error('Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
