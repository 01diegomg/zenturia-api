// --- src/controllers/auth.controller.js ---
import bcrypt from 'bcrypt';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import * as authService from '../services/auth.service.js';

/**
 * Register a new client
 */
export async function registerClient(req, res) {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Nombre, email y contraseña son requeridos.'
            });
        }

        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'El formato del email no es válido.'
            });
        }

        // Validar fortaleza de contraseña (mínimo 8 caracteres)
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe tener al menos 8 caracteres.'
            });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Este correo electrónico ya está registrado.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);

        // Create user
        const newUser = await prisma.user.create({
            data: { name, email, password: hashedPassword }
        });

        // Generate tokens
        const accessToken = authService.generateAccessToken(newUser);
        const refreshToken = await authService.generateRefreshToken(newUser);

        res.status(201).json({
            success: true,
            message: 'Usuario registrado con éxito',
            user: {
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al registrar usuario.'
        });
    }
}

/**
 * Client login
 */
export async function loginClient(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y contraseña son requeridos.'
            });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Email o contraseña incorrectos.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Email o contraseña incorrectos.'
            });
        }

        // Generate tokens
        const accessToken = authService.generateAccessToken(user);
        const refreshToken = await authService.generateRefreshToken(user);

        res.status(200).json({
            success: true,
            message: 'Login exitoso',
            user: {
                name: user.name,
                email: user.email,
                role: user.role
            },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Error en login cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al iniciar sesión.'
        });
    }
}

/**
 * Admin login
 */
export async function loginAdmin(req, res) {
    try {
        const { user: email, pass: password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Usuario y contraseña son requeridos.'
            });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || user.role !== 'ADMIN') {
            return res.status(401).json({
                success: false,
                message: 'Credenciales de admin incorrectas.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales de admin incorrectas.'
            });
        }

        // Generate tokens
        const accessToken = authService.generateAccessToken(user);
        const refreshToken = await authService.generateRefreshToken(user);

        res.status(200).json({
            success: true,
            message: 'Login de admin exitoso',
            user: {
                name: user.name,
                email: user.email,
                role: user.role
            },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Error en login admin:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al iniciar sesión.'
        });
    }
}

/**
 * Refresh access token
 */
export async function refreshToken(req, res) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token requerido.'
            });
        }

        const result = await authService.refreshTokens(refreshToken);

        if (!result) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token inválido o expirado.'
            });
        }

        res.status(200).json({
            success: true,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            user: result.user
        });
    } catch (error) {
        console.error('Error en refresh token:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al renovar token.'
        });
    }
}

/**
 * Logout (invalidate refresh token)
 */
export async function logout(req, res) {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            await authService.invalidateRefreshToken(refreshToken);
        }

        res.status(200).json({
            success: true,
            message: 'Sesión cerrada con éxito.'
        });
    } catch (error) {
        console.error('Error en logout:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al cerrar sesión.'
        });
    }
}

/**
 * Logout from all devices
 */
export async function logoutAll(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida.'
            });
        }

        // Invalidate all refresh tokens
        await authService.invalidateAllUserTokens(req.user.userId);

        // Increment token version to invalidate all access tokens
        await authService.incrementTokenVersion(req.user.userId);

        res.status(200).json({
            success: true,
            message: 'Todas las sesiones cerradas con éxito.'
        });
    } catch (error) {
        console.error('Error en logout all:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al cerrar sesiones.'
        });
    }
}

/**
 * Get current user info
 */
export async function getCurrentUser(req, res) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado.'
            });
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al obtener información del usuario.'
        });
    }
}

/**
 * Update user profile
 */
export async function updateProfile(req, res) {
    try {
        const { name, phone, currentPassword, newPassword } = req.body;
        const userId = req.user.userId;

        // Get current user
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado.'
            });
        }

        // Prepare update data
        const updateData = {};

        // Update name if provided
        if (name && name.trim()) {
            if (name.trim().length < 2 || name.trim().length > 50) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre debe tener entre 2 y 50 caracteres.'
                });
            }
            updateData.name = name.trim();
        }

        // Update phone if provided
        if (phone !== undefined) {
            const phoneRegex = /^[\d\s\-\+\(\)]*$/;
            if (phone && !phoneRegex.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: 'El formato del teléfono no es válido.'
                });
            }
            updateData.phone = phone.trim();
        }

        // Update password if provided
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Debes proporcionar tu contraseña actual para cambiarla.'
                });
            }

            // Verify current password
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'La contraseña actual es incorrecta.'
                });
            }

            // Validate new password
            if (newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'La nueva contraseña debe tener al menos 8 caracteres.'
                });
            }

            updateData.password = await bcrypt.hash(newPassword, config.bcryptSaltRounds);
        }

        // Check if there's anything to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionaron datos para actualizar.'
            });
        }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true
            }
        });

        res.status(200).json({
            success: true,
            message: 'Perfil actualizado con éxito.',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor al actualizar el perfil.'
        });
    }
}

export default {
    registerClient,
    loginClient,
    loginAdmin,
    refreshToken,
    logout,
    logoutAll,
    getCurrentUser,
    updateProfile
};
