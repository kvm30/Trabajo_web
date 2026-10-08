const VoteModel = require('../models/vote.model');

const AuditController = {
  async verify(req, res) {
    try {
      const hash = String(req.params.hash || '').trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(hash)) {
        return res.status(400).json({ success: false, message: 'El comprobante debe ser un SHA256 de 64 caracteres hex' });
      }
      const found = await VoteModel.verify(hash);
      res.json({ success: true, data: found ? { counted: true, ...found } : { counted: false } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  async chain(req, res) {
    try { res.json({ success: true, data: await VoteModel.chain(req.params.id) }); }
    catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  async integrity(req, res) {
    try { res.json({ success: true, data: await VoteModel.integrity(Number(req.params.id)) }); }
    catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },
};

module.exports = AuditController;
