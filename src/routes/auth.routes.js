const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');
const { registerSchema, loginSchema, refreshSchema } = require('../validators/auth.validator');
const upload = require('../middlewares/upload.middleware');

/**
 * @swagger
 * /auth/complexes:
 *   get:
 *     summary: Get list of all complexes for registration
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: List of complexes
 */
router.get('/complexes', authController.listComplexes);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new resident
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, phone, password, full_name]
 *             properties:
 *               email: { type: string }
 *               phone: { type: string }
 *               password: { type: string }
 *               full_name: { type: string }
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post('/register', authLimiter, validate(registerSchema), authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login to the platform
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Returns access and refresh tokens
 */
router.post('/login', authLimiter, validate(loginSchema), authController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh JWT Access Token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: New access token generated
 */
router.post('/refresh', validate(refreshSchema), authController.refresh);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile payload
 */
router.get('/me', requireAuth, authController.getMe);

// Profile & Password Update
router.put('/me/profile', requireAuth, authController.updateProfile);
router.put('/me/password', requireAuth, authController.changePassword);

// Avatar Upload
router.put('/me/avatar', requireAuth, upload.avatarUpload, authController.updateAvatar);

module.exports = router;
