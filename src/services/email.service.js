// --- src/services/email.service.js ---
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';

// Configure transporter
let transporter = null;

// Cache del nombre del negocio
let cachedBusinessName = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene el nombre del negocio de la base de datos (con cache)
 */
async function getBusinessName() {
    const now = Date.now();

    // Usar cache si está disponible y no ha expirado
    if (cachedBusinessName && (now - cacheTimestamp) < CACHE_DURATION) {
        return cachedBusinessName;
    }

    try {
        const siteContent = await prisma.siteContent.findUnique({
            where: { id: 'main' },
            select: { businessName: true }
        });
        cachedBusinessName = siteContent?.businessName || 'Tu Barbería';
        cacheTimestamp = now;
        return cachedBusinessName;
    } catch (error) {
        console.error('Error al obtener nombre del negocio:', error);
        return cachedBusinessName || 'Tu Barbería';
    }
}

/**
 * Initialize email transporter
 */
export function initializeTransporter() {
    if (!config.sendgridApiKey) {
        console.warn('⚠️  SendGrid API key not configured. Emails will not be sent.');
        return;
    }

    transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
            user: 'apikey',
            pass: config.sendgridApiKey
        }
    });
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.from] - Sender email
 */
export async function sendEmail({ to, subject, html, from }) {
    if (!transporter) {
        console.log('Email not sent (transporter not initialized):', { to, subject });
        return false;
    }

    try {
        // Obtener nombre del negocio dinámicamente
        const businessName = await getBusinessName();

        await transporter.sendMail({
            from: from || `"${businessName}" <${config.senderEmail}>`,
            to,
            subject,
            html
        });
        console.log(`✉️  Email sent to ${to}: ${subject}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

/**
 * Send appointment confirmation email to client
 */
export async function sendAppointmentConfirmation(user, service, date) {
    const businessName = await getBusinessName();
    const formattedDate = date.toLocaleDateString('es-ES', { dateStyle: 'full' });
    const formattedTime = date.toLocaleTimeString('es-ES', { timeStyle: 'short' });

    return sendEmail({
        to: user.email,
        subject: `¡Tu cita en ${businessName} ha sido confirmada!`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #CFAF7C;">
                    <h1 style="color: #333; margin: 0;">${businessName}</h1>
                </div>
                <div style="padding: 30px 0;">
                    <h2 style="color: #333;">¡Hola, ${user.name}!</h2>
                    <p style="color: #666; font-size: 16px;">Tu cita ha sido confirmada con éxito.</p>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Detalles de la Cita:</h3>
                        <p style="margin: 10px 0;"><strong>Servicio:</strong> ${service.name}</p>
                        <p style="margin: 10px 0;"><strong>Fecha:</strong> ${formattedDate}</p>
                        <p style="margin: 10px 0;"><strong>Hora:</strong> ${formattedTime}</p>
                    </div>
                    <p style="color: #666;">¡Te esperamos!</p>
                </div>
                <div style="text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #999; font-size: 12px;">
                    <p>Este es un correo automático de ${businessName}</p>
                </div>
            </div>
        `
    });
}

/**
 * Send cancellation confirmation to client
 */
export async function sendCancellationToClient(user, service, date) {
    const businessName = await getBusinessName();
    const formattedDate = date.toLocaleDateString('es-ES', { dateStyle: 'full' });

    return sendEmail({
        to: user.email,
        subject: `Cita cancelada - ${businessName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #CFAF7C;">
                    <h1 style="color: #333; margin: 0;">${businessName}</h1>
                </div>
                <div style="padding: 30px 0;">
                    <h2 style="color: #333;">Hola, ${user.name}</h2>
                    <p style="color: #666; font-size: 16px;">Te confirmamos que tu cita ha sido cancelada exitosamente.</p>
                    <div style="background-color: #fff3f3; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                        <h3 style="color: #333; margin-top: 0;">Cita cancelada:</h3>
                        <p style="margin: 10px 0;"><strong>Servicio:</strong> ${service.name}</p>
                        <p style="margin: 10px 0;"><strong>Fecha:</strong> ${formattedDate}</p>
                    </div>
                    <p style="color: #666;">Esperamos verte de nuevo pronto. Puedes agendar una nueva cita cuando gustes.</p>
                </div>
                <div style="text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #999; font-size: 12px;">
                    <p>Este es un correo automático de ${businessName}</p>
                </div>
            </div>
        `
    });
}

/**
 * Send cancellation notification to admin
 */
export async function sendCancellationToAdmin(user, service, date) {
    const businessName = await getBusinessName();
    const formattedDate = date.toLocaleDateString('es-ES', { dateStyle: 'full' });
    const formattedTime = date.toLocaleTimeString('es-ES', { timeStyle: 'short' });

    return sendEmail({
        to: config.adminEmail,
        subject: `[${businessName}] Cancelación: ${user.name} - ${formattedDate}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #ef4444; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0;">Notificación de Cancelación</h2>
                </div>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px; color: #333;">El cliente <strong>${user.name}</strong> (${user.email}) ha cancelado su cita.</p>
                    <div style="background-color: white; padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <h3 style="color: #333; margin-top: 0;">Detalles:</h3>
                        <p style="margin: 8px 0;"><strong>Servicio:</strong> ${service.name}</p>
                        <p style="margin: 8px 0;"><strong>Fecha:</strong> ${formattedDate}</p>
                        <p style="margin: 8px 0;"><strong>Hora:</strong> ${formattedTime}</p>
                    </div>
                </div>
            </div>
        `
    });
}

/**
 * Send admin cancellation notification to client
 */
export async function sendAdminCancellationToClient(user, service, date) {
    const businessName = await getBusinessName();
    const formattedDate = date.toLocaleDateString('es-ES', { dateStyle: 'full' });

    return sendEmail({
        to: user.email,
        subject: `Aviso: Tu cita en ${businessName} ha sido cancelada`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #CFAF7C;">
                    <h1 style="color: #333; margin: 0;">${businessName}</h1>
                </div>
                <div style="padding: 30px 0;">
                    <h2 style="color: #333;">Hola, ${user.name}</h2>
                    <p style="color: #666; font-size: 16px;">Te informamos que tu cita ha sido cancelada por el establecimiento.</p>
                    <div style="background-color: #fff3f3; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                        <h3 style="color: #333; margin-top: 0;">Cita cancelada:</h3>
                        <p style="margin: 10px 0;"><strong>Servicio:</strong> ${service.name}</p>
                        <p style="margin: 10px 0;"><strong>Fecha:</strong> ${formattedDate}</p>
                    </div>
                    <p style="color: #666;">Lamentamos cualquier inconveniente. Por favor, no dudes en agendar una nueva cita cuando gustes.</p>
                </div>
                <div style="text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #999; font-size: 12px;">
                    <p>Este es un correo automático de ${businessName}</p>
                </div>
            </div>
        `
    });
}

export default {
    initializeTransporter,
    sendEmail,
    sendAppointmentConfirmation,
    sendCancellationToClient,
    sendCancellationToAdmin,
    sendAdminCancellationToClient
};
