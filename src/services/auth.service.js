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
const TOKEN_GRACE_PERIOD_MS = 30000; // 30 seconds grace period for old tokens

// In-memory cache for recently rotated tokens (to handle race conditions)
const rotatedTokensCache = new Map();

/**
 * Generate an access token for a user
 * @param {Object} user - User object with id, email, role, tokenVersion
 * @returns {string} JWT access token
 */
export function generateAccessToken(user) {
    // Asegurar que tokenVersion tenga un valor numérico (default 0)
    const tokenVersion = typeof user.tokenVersion === 'number' ? user.tokenVersion : 0;

    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role,
            tokenVersion: tokenVersion
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
 * Includes grace period to handle race conditions with concurrent requests
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object|null>} New tokens or null if invalid
 */
export async function refreshTokens(refreshToken) {
    try {
        // Check if this token was recently rotated (race condition handling)
        const cachedResult = rotatedTokensCache.get(refreshToken);
        if (cachedResult && Date.now() - cachedResult.timestamp < TOKEN_GRACE_PERIOD_MS) {
            console.log('[Auth] Returning cached tokens for recently rotated token');
            return cachedResult.result;
        }

        // Find the refresh token in database
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true }
        });

        if (!storedToken) {
            // Token not found - might have been rotated, check cache
            const cachedFallback = rotatedTokensCache.get(refreshToken);
            if (cachedFallback && Date.now() - cachedFallback.timestamp < TOKEN_GRACE_PERIOD_MS) {
                console.log('[Auth] Token was rotated, returning cached result');
                return cachedFallback.result;
            }
            console.log('[Auth] Refresh token not found and not in cache');
            return null;
        }

        // Check if token is expired
        if (new Date() > storedToken.expiresAt) {
            await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            return null;
        }

        const user = storedToken.user;

        // Generate new tokens BEFORE deleting old one
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = await generateRefreshToken(user);

        const result = {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        };

        // Cache the result for grace period BEFORE deleting old token
        rotatedTokensCache.set(refreshToken, {
            timestamp: Date.now(),
            result: result
        });

        // Delete the old refresh token (rotation)
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });

        // Clean up old cache entries periodically
        cleanupRotatedTokensCache();

        return result;
    } catch (error) {
        console.error('Error refreshing tokens:', error);
        return null;
    }
}

/**
 * Clean up expired entries from the rotated tokens cache
 */
function cleanupRotatedTokensCache() {
    const now = Date.now();
    for (const [token, data] of rotatedTokensCache.entries()) {
        if (now - data.timestamp > TOKEN_GRACE_PERIOD_MS * 2) {
            rotatedTokensCache.delete(token);
        }
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
