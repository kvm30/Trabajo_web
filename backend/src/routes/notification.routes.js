const { Router } = require('express');
const C = require('../controllers/notification.controller');
const { auth } = require('../middleware/auth');
const router = Router();

router.get('/', auth, C.list);
router.patch('/read-all', auth, C.read);
router.patch('/:id/read', auth, C.read);

module.exports = router;
