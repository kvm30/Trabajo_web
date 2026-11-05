const bcrypt = require('bcryptjs');
const AdminAuditModel = require('../models/adminAudit.model');
const UserModel = require('../models/user.model');
const parseCsv = require('../utils/csv');
const { isSmtpConfigured, sendAccountSetupEmail } = require('../utils/email');
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
  async importVoters(req, res) {
    try {
      if (typeof req.body.csv !== 'string' || req.body.csv.length > 256_000) {
        return res.status(400).json({ success: false, message: 'El CSV es obligatorio y no puede superar 256 KB' });
      }

      let parsed;
      try {
        parsed = parseCsv(req.body.csv);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      if (parsed.length < 2) {
        return res.status(400).json({ success: false, message: 'El CSV debe incluir encabezado name,email y al menos una persona' });
      }
      const headers = parsed[0].map((header) => header.toLowerCase());
      if (headers.length !== 2 || headers[0] !== 'name' || headers[1] !== 'email') {
        return res.status(400).json({ success: false, message: 'El encabezado debe ser exactamente: name,email' });
      }
      if (parsed.length - 1 > 500) {
        return res.status(400).json({ success: false, message: 'Puedes importar hasta 500 personas por archivo' });
      }

      const errors = [];
      const rows = [];
      const seen = new Set();
      for (let index = 1; index < parsed.length; index += 1) {
        const [rawName = '', rawEmail = '', ...extra] = parsed[index];
        const name = rawName.trim();
        const email = rawEmail.trim().toLowerCase();
        const line = index + 1;
        if (extra.length || parsed[index].length !== 2) {
          errors.push({ line, message: 'Cada fila debe tener solo nombre y correo' });
        } else if (name.length < 2 || name.length > 100) {
          errors.push({ line, message: 'El nombre debe tener entre 2 y 100 caracteres' });
        } else if (email.length > 150 || !validEmail(email)) {
          errors.push({ line, message: 'El correo no es válido' });
        } else if (seen.has(email)) {
          errors.push({ line, message: 'El correo está repetido en el archivo' });
        } else {
          seen.add(email);
          rows.push({ line, name, email });
        }
      }

      const existingEmails = new Set(await UserModel.findExistingEmails(rows.map((row) => row.email)));
      const validRows = rows.filter((row) => {
        if (!existingEmails.has(row.email)) return true;
        errors.push({ line: row.line, message: 'El correo ya está registrado' });
        return false;
      });
      const preview = { valid_count: validRows.length, errors, users: validRows.map(({ name, email }) => ({ name, email })) };
      if (req.body.preview === true) {
        return res.json({ success: true, data: preview });
      }
      if (errors.length) {
        return res.status(400).json({ success: false, message: 'Corrige los errores del CSV antes de importar', data: preview });
      }
      if (!validRows.length) {
        return res.status(400).json({ success: false, message: 'El archivo no contiene personas válidas' });
      }
      if (!isSmtpConfigured()) {
        return res.status(503).json({
          success: false,
          message: 'Configura SMTP para enviar los enlaces de activación antes de importar votantes',
        });
      }

      const created = await UserModel.createInvitedVoters(validRows, req.user.id);
      const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
      const invitationFailures = [];
      for (const user of created) {
        const setupUrl = `${appUrl}/reset-password?token=${encodeURIComponent(user.token)}`;
        try {
          await sendAccountSetupEmail(user.email, setupUrl);
        } catch (err) {
          console.error(`No se pudo enviar la invitación a ${user.email}:`, err.message);
          invitationFailures.push(user.email);
        }
      }
      res.status(201).json({
        success: true,
        data: { created: created.length, invitationFailures },
      });
    } catch (err) {
      console.error('No se pudieron importar las cuentas votantes:', err.message);
      res.status(500).json({ success: false, message: 'No se pudieron importar las cuentas votantes' });
    }
  },

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
      await AdminAuditModel.record(req.user.id, 'user.updated', 'user', user.id, `Actualizó la cuenta de ${user.name}`);
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async setRole(req, res) {
    try {
      const { role } = req.body;
      if (!['voter', 'admin'].includes(role)) {
        return res.status(400).json({ success: false, message: 'El rol debe ser voter o admin' });
      }
      if (Number(req.params.id) === Number(req.user.id) && role !== 'admin') {
        return res.status(400).json({ success: false, message: 'No puedes retirar tu propio rol de administrador' });
      }
      const user = await UserModel.setRole(req.params.id, role);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      await AdminAuditModel.record(req.user.id, 'user.role_changed', 'user', user.id, `Cambió el rol de ${user.name} a ${role}`);
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async setActive(req, res) {
    try {
      if (typeof req.body.active !== 'boolean') {
        return res.status(400).json({ success: false, message: 'active debe ser true o false' });
      }
      if (Number(req.params.id) === Number(req.user.id) && req.body.active === false) {
        return res.status(400).json({ success: false, message: 'No puedes desactivar tu propia cuenta' });
      }
      const user = await UserModel.setActive(req.params.id, req.body.active);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      await AdminAuditModel.record(req.user.id, 'user.status_changed', 'user', user.id, `${req.body.active ? 'Activó' : 'Desactivó'} la cuenta de ${user.name}`);
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async remove(req, res) {
    try {
      if (Number(req.params.id) === Number(req.user.id)) {
        return res.status(400).json({ success: false, message: 'No puedes eliminar tu propia cuenta' });
      }
      const user = await UserModel.delete(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      await AdminAuditModel.record(req.user.id, 'user.deleted', 'user', user.id, 'Eliminó una cuenta de usuario');
      res.json({ success: true, message: 'Usuario eliminado correctamente' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = UserController;
