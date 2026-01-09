// prisma/seed.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt'; // <--- Se importa bcrypt

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // Limpiar tablas existentes para un estado limpio
  await prisma.appointment.deleteMany().catch(e => console.log("No appointments to delete or error:", e.message));
  await prisma.galleryImage.deleteMany().catch(e => console.log("No gallery images to delete or error:", e.message));
  await prisma.scheduleOverride.deleteMany().catch(e => console.log("No schedule overrides to delete or error:", e.message));
  await prisma.service.deleteMany().catch(e => console.log("No services to delete or error:", e.message));
  await prisma.user.deleteMany().catch(e => console.log("No users to delete or error:", e.message));
  await prisma.workSchedule.deleteMany().catch(e => console.log("No work schedules to delete or error:", e.message));
  await prisma.siteContent.deleteMany().catch(e => console.log("No site content to delete or error:", e.message));
  console.log('Previous data cleaned.');

  // Crear el contenido principal del sitio
  await prisma.siteContent.create({
    data: {
      id: 'main',
      heroTitle: "Estilo & Precisión",
      heroSubtitle: "La experiencia de barbería clásica para el hombre moderno.",
      aboutText: "<p class='text-lg text-gray-300 mb-4'>En Barber Studio Cruzito, no solo cortamos cabello, creamos experiencias donde la tradición y la modernidad se encuentran. Nuestro equipo de barberos expertos se dedica a perfeccionar tu estilo con una precisión inigualable.</p><p class='text-lg text-gray-300'>Utilizamos solo los mejores productos y técnicas para asegurar que salgas luciendo y sintiéndote impecable. Tu estilo es nuestra firma.</p>",
      aboutImage: "https://images.unsplash.com/photo-1621607512214-6c349036a732?q=80&w=1974&auto=format&fit=crop",
      heroBackgroundType: 'IMAGE',
      heroBackgroundValue: "https://images.unsplash.com/photo-15993512021aa5a48587T83?q=80&w=2070&auto=format&fit=crop",
      locationAddress: "Plaza de la Constitución S/N, Centro,<br>43600 Tulancingo de Bravo, Hgo.",
      locationSchedule: "Lunes a Sábado<br>9:00 AM - 6:00 PM",
      locationMapUrl: "http://googleusercontent.com/maps/google.com/0",
      colorAccent: "#CFAF7C",
      colorBackground: "#0a0a0a",
      colorTextMain: "#FFFFFF",
      colorTextSubtle: "#cccccc",
    }
  });
  console.log('Site content created.');

  // Crear el horario de trabajo por defecto
  const defaultSchedule = Array.from({ length: 7 }, (_, i) => {
      const isOff = i === 0; // Domingo cerrado
      const hours = isOff ? [] : [{ start: "09:00", end: "18:00" }];
      
      return {
          dayOfWeek: i,
          workingHours: JSON.stringify(hours),
          isDayOff: isOff
      };
  });
  await prisma.workSchedule.createMany({ data: defaultSchedule });
  console.log('Default schedule created.');
  
  // Crear servicios de ejemplo
  await prisma.service.createMany({
    data: [
      { id: "s1", name: "Corte Clásico de Caballero", description: "Un corte de precisión adaptado a tu estilo.", price: 350, duration: 45 },
      { id: "s2", name: "Afeitado Premium con Toalla Caliente", description: "La experiencia de afeitado definitiva.", price: 400, duration: 60 },
      { id: "s3", name: "Diseño y Perfilado de Barba", description: "Dale forma y definición a tu barba.", price: 250, duration: 30 }
    ]
  });
  console.log('Services created.');

  // --- SECCIÓN DE USUARIOS MODIFICADA ---

  // Encriptamos las contraseñas
  const saltRounds = 10;
  const adminPassword = await bcrypt.hash('admin123', saltRounds);
  const clientPassword = await bcrypt.hash('123', saltRounds);

  // Crear usuario Administrador
  await prisma.user.create({
    data: {
      email: 'admin@barberia.com',
      name: 'Admin',
      password: adminPassword, // <- Contraseña encriptada
      role: 'ADMIN',
    },
  });
  console.log('Admin user created.');

  // Crear usuario de ejemplo (cliente)
  await prisma.user.create({
    data: {
      email: 'cliente@ejemplo.com',
      name: 'Juan Cliente',
      password: clientPassword, // <- Contraseña encriptada
      role: 'CLIENT', 
    },
  });
  console.log('Sample client user created.');

  console.log('Seeding finished.');
  
  await prisma.user.create({
    data: {
      email: 'walkin@barberia.com',
      name: 'Cliente Presencial',
      password: 'no-password', // No necesita una contraseña segura
      role: 'CLIENT', 
    },
  });
  console.log('Walk-in user created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  