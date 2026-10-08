const bcrypt = require('bcryptjs');
const UserModel = require('../models/user.model');
const { sign } = require('../middleware/auth');

const AuthController = {
  async register(req, res) {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'name, email y password son requeridos' });
      }
      if (await UserModel.findByEmail(email)) {
        return res.status(409).json({ success: false, message: 'El email ya está registrado' });
      }
      const user = await UserModel.create({ name, email, password });
      res.status(201).json({ success: true, data: { user, token: sign(user) } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const user = email && (await UserModel.findByEmail(email));
      if (!user || !(await bcrypt.compare(password || '', user.password))) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }
      const { password: _omit, ...safe } = user;
      res.json({ success: true, data: { user: safe, token: sign(user) } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = AuthController;
