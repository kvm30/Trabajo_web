const { Router } = require('express');
const AuthController = require('../controllers/auth.controller');
const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar votante (devuelve JWT)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInput'
 *     responses:
 *       201: { description: Registrado }
 *       409: { description: Email ya registrado }
 */
router.post('/register', AuthController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión (devuelve JWT)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, example: admin@votacion.com }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Credenciales inválidas }
 */
router.post('/login', AuthController.login);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicitar un enlace para restablecer la contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: votante@correo.com }
 *     responses:
 *       200: { description: Solicitud recibida }
 *       500: { description: No fue posible enviar el correo }
 */
router.post('/forgot-password', AuthController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Cambiar la contraseña con un enlace vigente
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Contraseña actualizada }
 *       400: { description: Datos inválidos o enlace vencido }
 */
router.post('/reset-password', AuthController.resetPassword);

module.exports = router;
