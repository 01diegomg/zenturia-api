// --- server.js (Versión Limpia y Definitiva) ---
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import fs from 'fs';
import cloudinary from './cloudinaryConfig.js';

const app = express();
const PORT = 3000;
const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ADMIN_EMAIL = 'diegomg306@gmail.com';

// --- Middlewares ---
app.use(cors());
app.use(express.json());        

// --- Configuración de Nodemail    er (SendGrid) ---
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});

// --- Configuración de Multer (Subida de archivos) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// =======================================================
// === RUTAS DE LA APLICACIÓN ===
// =======================================================

// --- Contenido Público ---
app.get('/content/public', async (req, res) => {
    try {
        const services = await prisma.service.findMany({ orderBy: { name: 'asc' } });
        const schedule = await prisma.workSchedule.findMany({ orderBy: { dayOfWeek: 'asc' }});
        const gallery = await prisma.galleryImage.findMany({ orderBy: { createdAt: 'desc' } });
        const siteContent = await prisma.siteContent.findUnique({ where: { id: 'main' } });

        if (!siteContent) {
            return res.status(404).json({ success: false, message: 'El contenido principal del sitio no ha sido inicializado.' });
        }

        res.status(200).json({
            hero: {
                title: siteContent.heroTitle,
                subtitle: siteContent.heroSubtitle,
                backgroundType: siteContent.heroBackgroundType,
                backgroundValue: siteContent.heroBackgroundValue
            },
            about: { text: siteContent.aboutText, image: siteContent.aboutImage },
            location: {
                address: siteContent.locationAddress,
                schedule: siteContent.locationSchedule,
                mapUrl: siteContent.locationMapUrl
            },
            palette: {
                accent: siteContent.colorAccent,
                background: siteContent.colorBackground,
                textMain: siteContent.colorTextMain,
                textSubtle: siteContent.colorTextSubtle
            },
            services, gallery, schedule
        });
    } catch (error) {
        console.error("Error en /content/public:", error);
        res.status(500).json({ success: false, message: 'Error del servidor al obtener el contenido del sitio.' });
    }
});

// --- Rutas de Gestión de Contenido (Admin) ---

app.put('/content/palette', async (req, res) => {
    try {
        const { accent, background, textMain, textSubtle } = req.body;
        await prisma.siteContent.update({
            where: { id: 'main' },
            data: {
                colorAccent: accent,
                colorBackground: background,
                colorTextMain: textMain,
                colorTextSubtle: textSubtle
            }
        });
        res.status(200).json({ success: true, message: 'Paleta de colores actualizada.' });
    } catch (error) {
        console.error("Error en /content/palette:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar los colores.' });
    }
});

app.put('/content/texts', async (req, res) => {
    try {
        const { heroTitle, heroSubtitle } = req.body;
        await prisma.siteContent.update({
            where: { id: 'main' },
            data: { heroTitle, heroSubtitle }
        });
        res.status(200).json({ success: true, message: 'Textos del sitio actualizados.' });
    } catch (error) {
        console.error("Error en /content/texts:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar los textos.' });
    }
});

app.put('/content/about', async (req, res) => {
    try {
        const { text, image } = req.body;
        await prisma.siteContent.update({
            where: { id: 'main' },
            data: { aboutText: text, aboutImage: image }
        });
        res.status(200).json({ success: true, message: 'Sección "Nuestra Esencia" actualizada.' });
    } catch (error) {
        console.error("Error en /content/about:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar la sección.' });
    }
});

app.put('/content/hero-background', async (req, res) => {
    try {
        const { type, value } = req.body;
        await prisma.siteContent.update({
            where: { id: 'main' },
            data: { heroBackgroundType: type, heroBackgroundValue: value }
        });
        res.status(200).json({ success: true, message: 'Fondo actualizado.' });
    } catch (error) {
        console.error("Error en /content/hero-background:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar el fondo.' });
    }
});

app.put('/content/location', async (req, res) => {
    try {
        const { address, schedule, mapUrl } = req.body;
        await prisma.siteContent.update({
            where: { id: 'main' },
            data: {
                locationAddress: address,
                locationSchedule: schedule,
                locationMapUrl: mapUrl
            }
        });
        res.status(200).json({ success: true, message: 'Sección de Ubicación actualizada.' });
    } catch (error) {
        console.error("Error en /content/location:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar la ubicación.' });
    }
});

// --- Subida de Imágenes a Cloudinary ---
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No se subió ningún archivo.' });
        }
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'barberia'
        });
        fs.unlinkSync(req.file.path);
        res.status(200).json({ success: true, url: result.secure_url });
    } catch (error) {
        console.error("Error en /upload:", error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: 'Error al subir la imagen.' });
    }
});

// --- Rutas de Galería ---
app.post('/gallery/images', async (req, res) => {
    try {
        const { url, altText } = req.body;
        const newImage = await prisma.galleryImage.create({ data: { url, altText } });
        res.status(201).json({ success: true, message: 'Imagen añadida a la galería.', image: newImage });
    } catch (error) {
        console.error("Error en POST /gallery/images:", error);
        res.status(500).json({ success: false, message: 'Error al añadir la imagen.' });
    }
});

app.delete('/gallery/images/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.galleryImage.delete({ where: { id } });
        res.status(200).json({ success: true, message: 'Imagen eliminada.' });
    } catch (error) {
        console.error(`Error en DELETE /gallery/images/${req.params.id}:`, error);
        res.status(500).json({ success: false, message: 'Error al eliminar la imagen.' });
    }
});

// --- Rutas de Servicios ---
app.post('/content/services',
    body('name', 'El nombre del servicio es obligatorio.').notEmpty().trim(),
    body('description', 'La descripción es obligatoria.').notEmpty().trim(),
    body('price', 'El precio debe ser un número válido.').isNumeric(),
    body('duration', 'La duración debe ser un número entero (ej. 30, 45, 60).').isInt(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: "Datos inválidos.", errors: errors.array() });
        }
        try {
            const { name, description, price, duration } = req.body;
            const newService = await prisma.service.create({
                data: { name, description, price: parseFloat(price), duration: parseInt(duration) }
            });
            res.status(201).json({ success: true, message: 'Servicio añadido.', service: newService });
        } catch (error) {
            console.error("Error en POST /content/services:", error);
            res.status(500).json({ success: false, message: 'Error al añadir el servicio.' });
        }
    }
);

app.put('/content/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, duration } = req.body;
        const updatedService = await prisma.service.update({
            where: { id },
            data: { name, description, price: parseFloat(price), duration: parseInt(duration) }
        });
        res.status(200).json({ success: true, message: 'Servicio actualizado.', service: updatedService });
    } catch (error) {
        console.error(`Error en PUT /content/services/${req.params.id}:`, error);
        res.status(500).json({ success: false, message: 'Error al actualizar el servicio.' });
    }
});

app.delete('/content/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.service.delete({ where: { id } });
        res.status(200).json({ success: true, message: 'Servicio eliminado.' });
    } catch (error) {
        console.error(`Error en DELETE /content/services/${req.params.id}:`, error);
        res.status(500).json({ success: false, message: 'Error al eliminar el servicio.' });
    }
});

// --- Lógica de Disponibilidad con Excepciones ---
app.get('/appointments/available-slots', async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ message: 'La fecha es requerida.' });
    }
    try {
        const requestedDate = new Date(date + 'T00:00:00.000Z');
        let scheduleForDay = await prisma.scheduleOverride.findUnique({ where: { date: requestedDate } });

        if (!scheduleForDay) {
            const dayOfWeek = requestedDate.getUTCDay();
            scheduleForDay = await prisma.workSchedule.findUnique({ where: { dayOfWeek } });
        }

        if (!scheduleForDay || scheduleForDay.isDayOff) {
            return res.json([]);
        }

        const workingHours = JSON.parse(scheduleForDay.workingHours);
        const allPossibleSlots = new Set();

        workingHours.forEach(interval => {
            let currentTime = new Date(`${date}T${interval.start}:00`);
            const endTime = new Date(`${date}T${interval.end}:00`);
            while (currentTime < endTime) {
                allPossibleSlots.add(currentTime.toTimeString().substring(0, 5));
                currentTime.setMinutes(currentTime.getMinutes() + 30);
            }
        });

        const startOfDay = new Date(date + 'T00:00:00.000Z');
        const endOfDay = new Date(date + 'T23:59:59.999Z');
        const existingAppointments = await prisma.appointment.findMany({ where: { date: { gte: startOfDay, lte: endOfDay } } });
        const bookedSlots = new Set(existingAppointments.map(app => app.date.toTimeString().substring(0, 5)));

        const availableSlots = [...allPossibleSlots].filter(slot => !bookedSlots.has(slot));
        res.json(availableSlots);
    } catch (error) {
        console.error(`Error en /appointments/available-slots para fecha ${date}:`, error);
        res.status(500).json({ message: "Error del servidor al calcular disponibilidad." });
    }
});

// --- Rutas para Gestionar Horarios y Excepciones ---
app.get('/schedule', async (req, res) => {
    try {
        const schedule = await prisma.workSchedule.findMany({ orderBy: { dayOfWeek: 'asc' } });
        res.status(200).json(schedule);
    } catch (error) {
        console.error("Error en GET /schedule:", error);
        res.status(500).json({ success: false, message: 'Error al obtener el horario.' });
    }
});

app.post('/schedule', async (req, res) => {
    try {
        const newSchedule = req.body;
        const updateTransactions = newSchedule.map(day =>
            prisma.workSchedule.update({
                where: { dayOfWeek: day.dayOfWeek },
                data: { workingHours: day.workingHours, isDayOff: day.isDayOff }
            })
        );
        await prisma.$transaction(updateTransactions);
        res.status(200).json({ success: true, message: 'Horario semanal actualizado con éxito.' });
    } catch (error) {
        console.error("Error en POST /schedule:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar el horario.' });
    }
});

app.get('/schedule/overrides', async (req, res) => {
    try {
        const overrides = await prisma.scheduleOverride.findMany();
        res.json(overrides);
    } catch (error) {
        console.error("Error en GET /schedule/overrides:", error);
        res.status(500).json({ message: 'Error al obtener las excepciones de horario.' });
    }
});

app.post('/schedule/overrides', async (req, res) => {
    try {
        const { date, workingHours, isDayOff } = req.body;
        const targetDate = new Date(date);
        const updatedOrCreated = await prisma.scheduleOverride.upsert({
            where: { date: targetDate },
            update: { workingHours, isDayOff },
            create: { date: targetDate, workingHours, isDayOff },
        });
        res.status(201).json({ success: true, message: 'Horario especial guardado.', override: updatedOrCreated });
    } catch (error) {
        console.error("Error en POST /schedule/overrides:", error);
        res.status(500).json({ success: false, message: 'Error al guardar el horario especial.' });
    }
});

app.delete('/schedule/overrides/:date', async (req, res) => {
    try {
        const { date } = req.params;
        await prisma.scheduleOverride.delete({ where: { date: new Date(date) } });
        res.status(200).json({ success: true, message: 'Horario especial eliminado. Se usará el horario semanal.' });
    } catch (error) {
        console.error(`Error en DELETE /schedule/overrides/${req.params.date}:`, error);
        res.status(500).json({ success: false, message: 'Error al eliminar la excepción.' });
    }
});


// --- Rutas de Citas ---

app.get('/appointments', async (req, res) => {
    try {
        const appointments = await prisma.appointment.findMany({
            include: {
                user: { select: { name: true, email: true } },
                service: { select: { name: true } }
            }
        });
        const formattedAppointments = {};
        appointments.forEach(app => {
            const dateKey = app.date.toISOString().split('T')[0];
            if (!formattedAppointments[dateKey]) {
                formattedAppointments[dateKey] = [];
            }
            formattedAppointments[dateKey].push({
                id: app.id,
                dateKey: dateKey,
                time: app.date.toTimeString().substring(0, 5),
                serviceName: app.service.name,
                userName: app.user.name,
                userEmail: app.user.email,
                status: app.status
            });
        });
        res.status(200).json(formattedAppointments);
    } catch (error) {
        console.error("Error en GET /appointments:", error);
        res.status(500).json({ success: false, message: 'Error al obtener las citas.' });
    }
});

app.post('/appointments/create', async (req, res) => {
    try {
        const { dateKey, serviceId, time, userEmail } = req.body;
        const requestedDateTime = new Date(`${dateKey}T${time}:00`);

        const user = await prisma.user.findUnique({ where: { email: userEmail } });
        const service = await prisma.service.findUnique({ where: { id: serviceId } });

        if (!user || !service) {
            return res.status(404).json({ success: false, message: 'Usuario o servicio no encontrado.' });
        }

        const newAppointment = await prisma.appointment.create({
            data: {
                date: requestedDateTime,
                userId: user.id,
                serviceId: service.id
            }
        });

        try {
            await transporter.sendMail({
                from: '"Barber Studio Cruzito" <diegomg306@gmail.com>',
                to: user.email,
                subject: '¡Tu cita ha sido confirmada!',
                html: `<h1>¡Hola, ${user.name}!</h1><p>Tu cita en Barber Studio Cruzito ha sido confirmada con éxito.</p><h3>Detalles de la Cita:</h3><ul><li><strong>Servicio:</strong> ${service.name}</li><li><strong>Fecha:</strong> ${requestedDateTime.toLocaleDateString('es-ES', { dateStyle: 'full' })}</li><li><strong>Hora:</strong> ${requestedDateTime.toLocaleTimeString('es-ES', { timeStyle: 'short' })}</li></ul><p>¡Te esperamos!</p>`,
            });
            console.log(`Correo de confirmación enviado a ${user.email}`);
        } catch (emailError) {
            console.error("Error al enviar el correo de confirmación:", emailError);
        }

        res.status(201).json({ success: true, message: '¡Tu cita ha sido confirmada con éxito!', appointment: newAppointment });
    } catch (error) {
        console.error("Error en POST /appointments/create:", error);
        res.status(500).json({ success: false, message: 'Error al crear la cita.' });
    }
});

app.delete('/appointments/:id', async (req, res) => {
    console.log('\n--- Cancelación de cita iniciada ---');
    try {
        const { id } = req.params;
        const { cancelledBy } = req.query;
        console.log(`ID de la cita a cancelar: ${id}`);
        console.log(`Cancelado por: ${cancelledBy || 'admin'}`);

        const appointmentToCancel = await prisma.appointment.findUnique({
            where: { id: id },
            include: {
                user: { select: { name: true, email: true } },
                service: { select: { name: true } }
            }
        });

        if (!appointmentToCancel) {
            console.log('ERROR: Cita no encontrada en la base de datos.');
            return res.status(404).json({ success: false, message: 'La cita no fue encontrada.' });
        }
        console.log('Cita encontrada:', appointmentToCancel);

        console.log('Intentando actualizar estado a CANCELLED...');
        const updatedAppointment = await prisma.appointment.update({
            where: { id: id },
            data: { status: 'CANCELLED' }
        });
        console.log('>>> Prisma reportó la actualización:', updatedAppointment);

        if (cancelledBy === 'client') {
            console.log('Enviando correos por cancelación de cliente...');
            try {
                await transporter.sendMail({
                    from: '"Barber Studio Cruzito" <diegomg306@gmail.com>',
                    to: appointmentToCancel.user.email,
                    subject: 'Has cancelado tu cita',
                    html: `<h1>Hola, ${appointmentToCancel.user.name},</h1><p>Te confirmamos que tu cita en Barber Studio Cruzito ha sido cancelada exitosamente, tal como lo solicitaste.</p><h3>Detalles de la cita cancelada:</h3><ul><li><strong>Servicio:</strong> ${appointmentToCancel.service.name}</li><li><strong>Fecha:</strong> ${appointmentToCancel.date.toLocaleDateString('es-ES', { dateStyle: 'full' })}</li></ul><p>Esperamos verte de nuevo pronto. Puedes agendar una nueva cita cuando quieras.</p>`,
                });
            } catch (error) { console.error("Error al enviar confirmación al cliente:", error); }

            try {
                await transporter.sendMail({
                    from: '"Notificaciones Barbería" <diegomg306@gmail.com>',
                    to: ADMIN_EMAIL,
                    subject: `Un cliente ha cancelado una cita: ${appointmentToCancel.user.name}`,
                    html: `<h1>Notificación de Cancelación</h1><p>El cliente <strong>${appointmentToCancel.user.name}</strong> (${appointmentToCancel.user.email}) ha cancelado su cita.</p><h3>Detalles:</h3><ul><li><strong>Servicio:</strong> ${appointmentToCancel.service.name}</li><li><strong>Fecha:</strong> ${appointmentToCancel.date.toLocaleDateString('es-ES', { dateStyle: 'full' })}</li><li><strong>Hora:</strong> ${appointmentToCancel.date.toLocaleTimeString('es-ES', { timeStyle: 'short' })}</li></ul>`,
                });
            } catch (error) { console.error("Error al enviar notificación al admin:", error); }

        } else {
            console.log('Enviando correos por cancelación de admin...');
            try {
                await transporter.sendMail({
                    from: '"Barber Studio Cruzito" <diegomg306@gmail.com>',
                    to: appointmentToCancel.user.email,
                    subject: 'Notificación de cancelación de cita',
                    html: `<h1>Hola, ${appointmentToCancel.user.name},</h1><p>Te informamos que tu cita en Barber Studio Cruzito ha sido cancelada por el administrador.</p><h3>Detalles de la cita cancelada:</h3><ul><li><strong>Servicio:</strong> ${appointmentToCancel.service.name}</li><li><strong>Fecha:</strong> ${appointmentToCancel.date.toLocaleDateString('es-ES', { dateStyle: 'full' })}</li></ul><p>Lamentamos cualquier inconveniente. Por favor, no dudes en agendar una nueva cita a través de nuestro sitio web.</p>`,
                });
            } catch (emailError) { console.error("Error al enviar el correo de cancelación:", emailError); }
        }

        console.log('--- Proceso de cancelación finalizado con éxito. ---');
        res.status(200).json({ success: true, message: 'Cita cancelada con éxito.' });
    } catch (error) {
        console.error('>>> ¡ERROR GRAVE DURANTE LA CANCELACIÓN!:', error);
        res.status(500).json({ success: false, message: 'Error del servidor al cancelar la cita.' });
    }
});

// --- Rutas de Autenticación ---
app.post('/login/admin', async (req, res) => {
    try {
        const { user: email, pass: password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.role !== 'ADMIN') {
            return res.status(401).json({ success: false, message: 'Credenciales de admin incorrectas' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            res.status(200).json({ success: true, message: 'Login de admin exitoso' });
        } else {
            res.status(401).json({ success: false, message: 'Credenciales de admin incorrectas' });
        }
    } catch (error) {
        console.error("Error en /login/admin:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
});

app.post('/login/client', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        const isMatch = user && await bcrypt.compare(password, user.password);
        if (isMatch) {
            res.status(200).json({ success: true, message: 'Login exitoso', user: { name: user.name, email: user.email } });
        } else {
            res.status(401).json({ success: false, message: 'Email o contraseña incorrectos' });
        }
    } catch (error) {
        console.error("Error en /login/client:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
});

app.post('/register/client', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Este correo electrónico ya está registrado.' });
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newUser = await prisma.user.create({ data: { name, email, password: hashedPassword } });
        res.status(201).json({ success: true, message: 'Usuario registrado con éxito', user: { name: newUser.name, email: newUser.email } });
    } catch (error) {
        console.error("Error en /register/client:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
});

// --- Iniciar Servidor ---
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT} ✅`));