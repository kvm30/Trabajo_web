const AdminAuditModel = require('../models/adminAudit.model');

const AdminAuditController = {
  async list(_req, res) {
    try {
      res.json({ success: true, data: await AdminAuditModel.latest() });
    } catch (err) {
      console.error('No se pudo cargar la bitácora administrativa:', err.message);
      res.status(500).json({ success: false, message: 'No se pudo cargar la bitácora administrativa' });
    }
  },
};

module.exports = AdminAuditController;
