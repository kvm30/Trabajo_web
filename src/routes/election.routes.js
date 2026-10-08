const { Router } = require('express');
const C = require('../controllers/election.controller');
const { auth, admin } = require('../middleware/auth');
const router = Router();

/**
 * @swagger
 * /api/elections:
 *   get:
 *     summary: Listar elecciones
 *     tags: [Elections]
 *     responses:
 *       200: { description: Lista de elecciones }
 *   post:
 *     summary: Crear elección (admin)
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, example: Elección de representante 2026 }
 *               description: { type: string }
 *     responses:
 *       201: { description: Creada }
 */
router.get('/', C.getAll);
router.post('/', auth, admin, C.create);

/**
 * @swagger
 * /api/elections/{id}:
 *   get:
 *     summary: Detalle de elección con candidatos y conteo
 *     tags: [Elections]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: OK }
 *       404: { description: No encontrada }
 */
router.get('/:id', C.getById);

/**
 * @swagger
 * /api/elections/{id}/candidates:
 *   post:
 *     summary: Agregar candidato (admin, solo en borrador)
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Ana Torres }
 *               description: { type: string }
 *     responses:
 *       201: { description: Candidato creado }
 */
router.post('/:id/candidates', auth, admin, C.addCandidate);

/**
 * @swagger
 * /api/elections/{id}/status:
 *   patch:
 *     summary: Cambiar estado (draft | open | closed) (admin)
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [draft, open, closed] }
 *     responses:
 *       200: { description: Actualizada }
 */
router.patch('/:id/status', auth, admin, C.setStatus);

/**
 * @swagger
 * /api/elections/{id}/results:
 *   get:
 *     summary: Conteo actual (también llega en vivo por socket)
 *     tags: [Elections]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/results', C.results);

/**
 * @swagger
 * /api/elections/{id}/has-voted:
 *   get:
 *     summary: ¿El usuario autenticado ya votó?
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:id/has-voted', auth, C.hasVoted);

/**
 * @swagger
 * /api/elections/{id}/vote:
 *   post:
 *     summary: Emitir voto anónimo; devuelve comprobante SHA256
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [candidate_id]
 *             properties:
 *               candidate_id: { type: integer, example: 1 }
 *     responses:
 *       201: { description: Voto registrado, comprobante emitido }
 *       400: { description: Elección cerrada o candidato inválido }
 *       409: { description: Ya votaste }
 */
router.post('/:id/vote', auth, C.vote);

module.exports = router;
