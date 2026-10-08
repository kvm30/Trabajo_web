const { Router } = require('express');
const C = require('../controllers/audit.controller');
const router = Router();

/**
 * @swagger
 * /api/audit/verify/{hash}:
 *   get:
 *     summary: Verificación ciudadana de un comprobante SHA256
 *     tags: [Audit]
 *     parameters:
 *       - { in: path, name: hash, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: counted true/false }
 */
router.get('/verify/:hash', C.verify);

/**
 * @swagger
 * /api/audit/{id}/chain:
 *   get:
 *     summary: Cadena pública de comprobantes de una elección
 *     tags: [Audit]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Lista de hashes encadenados }
 */
router.get('/:id/chain', C.chain);

/**
 * @swagger
 * /api/audit/{id}/integrity:
 *   get:
 *     summary: Recalcula la cadena y detecta manipulación
 *     tags: [Audit]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: valid true/false }
 */
router.get('/:id/integrity', C.integrity);

module.exports = router;
