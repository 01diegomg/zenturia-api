// --- src/services/auth.service.js ---
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error('FATAL: JWT_SECRET y JWT_REFRESH_SECRET deben estar configurados en las variables de entorno.');
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/**
 * Generate an access token for a user
 * @param {Object} user - User object with id, email, role, tokenVersion
 * @returns {string} JWT access token
 */
export function generateAccessToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role,
            tokenVersion: user.tokenVersion
        },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
}

/**
 * Generate a refresh token and store it in the database
 * @param {Object} user - User object with id
 * @returns {Promise<string>} Refresh token
 */
export async function generateRefreshToken(user) {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
        data: {
            token,
            userId: user.id,
            expiresAt
        }
    });

    return token;
}

/**
 * Verify an access token
 * @param {string} token - JWT access token
 * @returns {Object|null} Decoded token payload or null if invalid
 */
export function verifyAccessToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Refresh tokens using a valid refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object|null>} New tokens or null if invalid
 */
export async function refreshTokens(refreshToken) {
    try {
        // Find the refresh token in database
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true }
        });

        if (!storedToken) {
            return null;
        }

        // Check if token is expired
        if (new Date() > storedToken.expiresAt) {
            await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            return null;
        }

        const user = storedToken.user;

        // Delete the old refresh token (rotation)
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });

        // Generate new tokens
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = await generateRefreshToken(user);

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        };
    } catch (error) {
        console.error('Error refreshing tokens:', error);
        return null;
    }
}

/**
 * Invalidate all refresh tokens for a user (logout from all devices)
 * @param {string} userId - User ID
 */
export async function invalidateAllUserTokens(userId) {
    await prisma.refreshToken.deleteMany({
        where: { userId }
    });
}

/**
 * Invalidate a specific refresh token (single logout)
 * @param {string} refreshToken - The refresh token to invalidate
 */
export async function invalidateRefreshToken(refreshToken) {
    try {
        await prisma.refreshToken.delete({
            where: { token: refreshToken }
        });
    } catch (error) {
        // Token might not exist, that's okay
    }
}

/**
 * Increment user's token version (invalidates all existing access tokens)
 * @param {string} userId - User ID
 */
export async function incrementTokenVersion(userId) {
    await prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } }
    });
}

/**
 * Clean up expired refresh tokens (call periodically)
 */
export async function cleanupExpiredTokens() {
    await prisma.refreshToken.deleteMany({
        where: {
            expiresAt: { lt: new Date() }
        }
    });
}

export default {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    refreshTokens,
    invalidateAllUserTokens,
    invalidateRefreshToken,
    incrementTokenVersion,
    cleanupExpiredTokens
};
