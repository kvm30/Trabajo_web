const bcrypt = require('bcryptjs');
const UserModel = require('../models/user.model');
const { sign } = require('../middleware/auth');

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPassword(value) {
  return typeof value === 'string'
    && value.length >= 8
    && /[A-Za-z]/.test(value)
    && /\d/.test(value);
}

const UserController = {
  async getMe(req, res) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateMe(req, res) {
    try {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (name.length < 2 || name.length > 100) {
        return res.status(400).json({ success: false, message: 'El nombre debe tener entre 2 y 100 caracteres' });
      }
      if (!validEmail(email)) {
        return res.status(400).json({ success: false, message: 'Ingresa un email válido' });
      }
      if (await UserModel.findByEmailExceptId(email, req.user.id)) {
        return res.status(409).json({ success: false, message: 'El email ya está registrado' });
      }

      const user = await UserModel.update(req.user.id, { name, email });
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      res.json({ success: true, data: { user, token: sign(user) } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ success: false, message: 'Completa todos los campos de contraseña' });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Las contraseñas nuevas no coinciden' });
      }
      if (!validPassword(newPassword)) {
        return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres, una letra y un número' });
      }

      const currentHash = await UserModel.findPasswordById(req.user.id);
      if (!currentHash || !(await bcrypt.compare(currentPassword, currentHash))) {
        return res.status(400).json({ success: false, message: 'La contraseña actual no es correcta' });
      }
      if (await bcrypt.compare(newPassword, currentHash)) {
        return res.status(400).json({ success: false, message: 'La nueva contraseña debe ser diferente a la actual' });
      }

      await UserModel.updatePassword(req.user.id, newPassword);
      res.json({ success: true, data: { message: 'Contraseña actualizada correctamente' } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getAll(req, res) {
    try {
      const users = await UserModel.findAll();
      res.json({ success: true, data: users });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getById(req, res) {
    try {
      const user = await UserModel.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async create(req, res) {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'name, email y password son requeridos' });
      }

      const existing = await UserModel.findByEmail(email);
      if (existing) {
        return res.status(409).json({ success: false, message: 'El email ya está registrado' });
      }

      const user = await UserModel.create({ name, email, password });
      res.status(201).json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async update(req, res) {
    try {
      const { name, email } = req.body;
      if (!name || !email) {
        return res.status(400).json({ success: false, message: 'name y email son requeridos' });
      }

      const user = await UserModel.update(req.params.id, { name, email });
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async remove(req, res) {
    try {
      const user = await UserModel.delete(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      res.json({ success: true, message: 'Usuario eliminado correctamente' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = UserController;
