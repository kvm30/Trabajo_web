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

module.exports = router;
