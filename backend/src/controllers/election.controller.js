const ElectionModel = require('../models/election.model');
const VoteModel = require('../models/vote.model');
const socket = require('../socket');

const fail = (res, err) =>
  res.status(err.status || 500).json({ success: false, message: err.message });

const ElectionController = {
  async getAll(req, res) {
    try { res.json({ success: true, data: await ElectionModel.findAll() }); }
    catch (err) { fail(res, err); }
  },

  async getById(req, res) {
    try {
      const election = await ElectionModel.findById(req.params.id);
      if (!election) return res.status(404).json({ success: false, message: 'Elección no encontrada' });
      const results = await ElectionModel.results(election.id);
      res.json({ success: true, data: { ...election, ...results } });
    } catch (err) { fail(res, err); }
  },

  async create(req, res) {
    try {
      if (!req.body.title) return res.status(400).json({ success: false, message: 'title es requerido' });
      const e = await ElectionModel.create(req.body, req.user.id);
      socket.emitElectionsChanged();
      res.status(201).json({ success: true, data: e });
    } catch (err) { fail(res, err); }
  },

  async addCandidate(req, res) {
    try {
      if (!req.body.name) return res.status(400).json({ success: false, message: 'name es requerido' });
      const election = await ElectionModel.findById(req.params.id);
      if (!election) return res.status(404).json({ success: false, message: 'Elección no encontrada' });
      if (election.status !== 'draft') {
        return res.status(400).json({ success: false, message: 'Solo se agregan candidatos en borrador' });
      }
      const c = await ElectionModel.addCandidate(election.id, req.body);
      socket.emitResults(election.id, await ElectionModel.results(election.id));
      res.status(201).json({ success: true, data: c });
    } catch (err) { fail(res, err); }
  },

  async setStatus(req, res) {
    try {
      const { status } = req.body;
      if (!['draft', 'open', 'closed'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status debe ser draft, open o closed' });
      }
      const e = await ElectionModel.setStatus(req.params.id, status);
      if (!e) return res.status(404).json({ success: false, message: 'Elección no encontrada' });
      socket.emitElectionsChanged();
      res.json({ success: true, data: e });
    } catch (err) { fail(res, err); }
  },

  async results(req, res) {
    try { res.json({ success: true, data: await ElectionModel.results(req.params.id) }); }
    catch (err) { fail(res, err); }
  },

  async hasVoted(req, res) {
    try {
      res.json({ success: true, data: { voted: await ElectionModel.hasVoted(req.params.id, req.user.id) } });
    } catch (err) { fail(res, err); }
  },

  async vote(req, res) {
    try {
      const electionId = Number(req.params.id);
      const candidateId = Number(req.body.candidate_id);
      if (!candidateId) return res.status(400).json({ success: false, message: 'candidate_id es requerido' });

      const receipt = await VoteModel.cast({ electionId, candidateId, userId: req.user.id });
      res.status(201).json({ success: true, data: receipt });

      // Conteo en vivo: se transmite a todos los que miran esta elección.
      socket.emitResults(electionId, await ElectionModel.results(electionId));
    } catch (err) { if (!res.headersSent) fail(res, err); }
  },
};

module.exports = ElectionController;
