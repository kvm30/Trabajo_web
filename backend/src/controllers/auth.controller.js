const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const UserModel = require('../models/user.model');
const PasswordResetModel = require('../models/passwordReset.model');
const { sign } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/email');

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPassword(value) {
  return typeof value === 'string'
    && value.length >= 8
    && /[A-Za-z]/.test(value)
    && /\d/.test(value);
}

const AuthController = {
  async register(req, res) {
    try {
      const { name, email, password } = req.body;
      const cleanName = typeof name === 'string' ? name.trim() : '';
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!cleanName || !cleanEmail || !password) {
        return res.status(400).json({ success: false, message: 'name, email y password son requeridos' });
      }
      if (cleanName.length < 2 || cleanName.length > 100 || !validEmail(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Nombre o email inválido' });
      }
      if (!validPassword(password)) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres, una letra y un número' });
      }
      if (await UserModel.findByEmail(cleanEmail)) {
        return res.status(409).json({ success: false, message: 'El email ya está registrado' });
      }
      const user = await UserModel.create({ name: cleanName, email: cleanEmail, password });
      res.status(201).json({ success: true, data: { user, token: sign(user) } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const user = cleanEmail && (await UserModel.findByEmail(cleanEmail));
      if (!user || !(await bcrypt.compare(password || '', user.password))) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }
      if (user.active === false) {
        return res.status(403).json({ success: false, message: 'Esta cuenta está desactivada. Contacta al administrador.' });
      }
      const { password: _omit, ...safe } = user;
      res.json({ success: true, data: { user: safe, token: sign(user) } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ success: false, message: 'El email es requerido' });
      }

      const user = await UserModel.findByEmail(email.trim());
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await PasswordResetModel.save(user.id, tokenHash, expiresAt);

        const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
        await sendPasswordResetEmail(
          user.email,
          `${appUrl}/reset-password?token=${encodeURIComponent(token)}`
        );
      }

      res.json({
        success: true,
        data: { message: 'Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña.' },
      });
    } catch (err) {
      console.error('Error al solicitar recuperación de contraseña:', err.message);
      res.status(500).json({
        success: false,
        message: 'No fue posible enviar el correo de recuperación. Inténtalo más tarde.',
      });
    }
  },

  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      if (typeof token !== 'string' || !token || typeof password !== 'string' || !password) {
        return res.status(400).json({ success: false, message: 'El token y la contraseña son requeridos' });
      }
      if (!validPassword(password)) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres, una letra y un número' });
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const updated = await PasswordResetModel.updatePassword(tokenHash, password);
      if (!updated) {
        return res.status(400).json({ success: false, message: 'El enlace es inválido o venció. Solicita uno nuevo.' });
      }

      res.json({ success: true, data: { message: 'Contraseña actualizada' } });
    } catch (err) {
      console.error('Error al cambiar contraseña:', err.message);
      res.status(500).json({ success: false, message: 'No fue posible cambiar la contraseña' });
    }
  },
};

module.exports = AuthController;
