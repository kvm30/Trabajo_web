const jwt = require('jsonwebtoken');

const SECRET = () => process.env.JWT_SECRET || 'dev_secret';

const sign = (user) =>
  jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET(), { expiresIn: '8h' });

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Token requerido' });
  try {
    req.user = jwt.verify(token, SECRET());
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
}

function admin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Solo administradores' });
  }
  next();
}

module.exports = { auth, admin, sign };
