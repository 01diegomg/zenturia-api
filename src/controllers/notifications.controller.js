// --- src/controllers/notifications.controller.js ---
// Push notifications via Expo Push API
import { prisma } from '../config/database.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notification to a specific user
 * POST /notifications/send
 */
export async function sendNotification(req, res) {
    try {
        const { userId, title, body, data = {} } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId es requerido.'
            });
        }

        if (!title || !body) {
            return res.status(400).json({
                success: false,
                message: 'title y body son requeridos.'
            });
        }

        // Get user's push token
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, pushToken: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado.'
            });
        }

        if (!user.pushToken) {
            console.log(`[Notifications] User ${userId} has no push token registered`);
            return res.status(200).json({
                success: false,
                message: 'El usuario no tiene un token de notificaciones registrado.',
                sent: false
            });
        }

        // Validate Expo push token format
        if (!user.pushToken.startsWith('ExponentPushToken[') && !user.pushToken.startsWith('ExpoPushToken[')) {
            console.log(`[Notifications] Invalid push token format for user ${userId}`);
            return res.status(200).json({
                success: false,
                message: 'Token de notificaciones invalido.',
                sent: false
            });
        }

        // Send notification via Expo Push API
        console.log(`[Notifications] Sending to ${user.name} (${user.pushToken.substring(0, 30)}...)`);

        const message = {
            to: user.pushToken,
            sound: 'default',
            title: title,
            body: body,
            data: {
                ...data,
                sentAt: new Date().toISOString()
            },
            priority: 'high',
            channelId: 'default'
        };

        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message)
        });

        const result = await response.json();
        console.log(`[Notifications] Expo response:`, JSON.stringify(result));

        // Check for errors in response
        if (result.data && result.data.status === 'error') {
            console.log(`[Notifications] Error sending: ${result.data.message}`);

            // If token is invalid, remove it from user
            if (result.data.details?.error === 'DeviceNotRegistered') {
                await prisma.user.update({
                    where: { id: userId },
                    data: { pushToken: null }
                });
                console.log(`[Notifications] Removed invalid token for user ${userId}`);
            }

            return res.status(200).json({
                success: false,
                message: result.data.message || 'Error al enviar notificacion.',
                sent: false
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notificacion enviada correctamente.',
            sent: true,
            ticketId: result.data?.id || null
        });
    } catch (error) {
        console.error('[Notifications] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al enviar notificacion.'
        });
    }
}

/**
 * Send notification to multiple users
 * POST /notifications/send-batch
 */
export async function sendBatchNotifications(req, res) {
    try {
        const { userIds, title, body, data = {} } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'userIds debe ser un array no vacio.'
            });
        }

        if (!title || !body) {
            return res.status(400).json({
                success: false,
                message: 'title y body son requeridos.'
            });
        }

        // Get all users with push tokens
        const users = await prisma.user.findMany({
            where: {
                id: { in: userIds },
                pushToken: { not: null }
            },
            select: { id: true, pushToken: true }
        });

        if (users.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Ninguno de los usuarios tiene token de notificaciones.',
                sent: 0,
                total: userIds.length
            });
        }

        // Prepare messages
        const messages = users
            .filter(u => u.pushToken?.startsWith('ExponentPushToken[') || u.pushToken?.startsWith('ExpoPushToken['))
            .map(user => ({
                to: user.pushToken,
                sound: 'default',
                title: title,
                body: body,
                data: {
                    ...data,
                    sentAt: new Date().toISOString()
                },
                priority: 'high',
                channelId: 'default'
            }));

        if (messages.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No hay tokens validos para enviar.',
                sent: 0,
                total: userIds.length
            });
        }

        // Send batch to Expo
        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages)
        });

        const results = await response.json();
        const successCount = results.data?.filter(r => r.status === 'ok').length || 0;

        res.status(200).json({
            success: true,
            message: `Notificaciones enviadas: ${successCount} de ${messages.length}`,
            sent: successCount,
            total: userIds.length
        });
    } catch (error) {
        console.error('[Notifications] Batch error:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al enviar notificaciones.'
        });
    }
}

/**
 * Send notification to all users with a specific role
 * POST /notifications/send-to-role
 */
export async function sendToRole(req, res) {
    try {
        const { role, title, body, data = {} } = req.body;

        if (!role || !['CLIENT', 'ADMIN'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'role debe ser CLIENT o ADMIN.'
            });
        }

        if (!title || !body) {
            return res.status(400).json({
                success: false,
                message: 'title y body son requeridos.'
            });
        }

        // Get all users with the role and push token
        const users = await prisma.user.findMany({
            where: {
                role: role,
                pushToken: { not: null }
            },
            select: { id: true, pushToken: true }
        });

        if (users.length === 0) {
            return res.status(200).json({
                success: true,
                message: `No hay usuarios ${role} con token de notificaciones.`,
                sent: 0
            });
        }

        // Prepare messages
        const messages = users
            .filter(u => u.pushToken?.startsWith('ExponentPushToken[') || u.pushToken?.startsWith('ExpoPushToken['))
            .map(user => ({
                to: user.pushToken,
                sound: 'default',
                title: title,
                body: body,
                data: data,
                priority: 'high',
                channelId: 'default'
            }));

        // Send batch
        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages)
        });

        const results = await response.json();
        const successCount = results.data?.filter(r => r.status === 'ok').length || 0;

        res.status(200).json({
            success: true,
            message: `Notificaciones enviadas a ${successCount} usuarios ${role}.`,
            sent: successCount,
            total: users.length
        });
    } catch (error) {
        console.error('[Notifications] Role error:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor.'
        });
    }
}

export default {
    sendNotification,
    sendBatchNotifications,
    sendToRole
};
