const ElectionModel = require('../models/election.model');
const VoteModel = require('../models/vote.model');
const socket = require('../socket');

const fail = (res, err) =>
  res.status(err.status || 500).json({ success: false, message: err.message });

function parseSchedule(startsAt, endsAt) {
  const starts = startsAt ? new Date(startsAt) : null;
  const ends = endsAt ? new Date(endsAt) : null;
  if (!starts || !ends || Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    throw Object.assign(new Error('La fecha de inicio y cierre son requeridas y deben ser válidas'), { status: 400 });
  }
  if (starts >= ends) {
    throw Object.assign(new Error('La fecha de cierre debe ser posterior a la fecha de inicio'), { status: 400 });
  }
  return { starts, ends };
}

const ElectionController = {
  async getAll(req, res) {
    try {
      await ElectionModel.reconcileSchedule();
      res.json({ success: true, data: await ElectionModel.findAll() });
    }
    catch (err) { fail(res, err); }
  },

  async getById(req, res) {
    try {
      await ElectionModel.reconcileSchedule();
      const election = await ElectionModel.findById(req.params.id);
      if (!election) return res.status(404).json({ success: false, message: 'Elección no encontrada' });
      const results = await ElectionModel.results(election.id);
      res.json({ success: true, data: { ...election, ...results } });
    } catch (err) { fail(res, err); }
  },

  async create(req, res) {
    try {
      if (!req.body.title?.trim()) return res.status(400).json({ success: false, message: 'title es requerido' });
      const { starts, ends } = parseSchedule(req.body.starts_at, req.body.ends_at);
      if (starts <= new Date()) {
        return res.status(400).json({ success: false, message: 'La fecha de inicio debe ser futura' });
      }
      const e = await ElectionModel.create({
        ...req.body,
        title: req.body.title.trim(),
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
      }, req.user.id);
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
      const currentElection = await ElectionModel.findById(req.params.id);
      if (!currentElection) {
        return res.status(404).json({ success: false, message: 'Elección no encontrada' });
      }
      if (status === 'open') {
        if (!(await ElectionModel.countCandidates(currentElection.id))) {
          return res.status(400).json({
            success: false,
            message: 'Agrega al menos un candidato antes de abrir la elección',
          });
        }
        if (!currentElection.starts_at || !currentElection.ends_at) {
          return res.status(400).json({ success: false, message: 'La elección debe tener fechas de inicio y cierre' });
        }
        const starts = new Date(currentElection.starts_at);
        const ends = new Date(currentElection.ends_at);
        const now = new Date();
        if (now < starts) {
          return res.status(400).json({ success: false, message: 'La elección aún no puede abrirse porque la fecha de inicio no ha llegado' });
        }
        if (now >= ends) {
          return res.status(400).json({ success: false, message: 'La elección no puede abrirse porque su fecha de cierre ya pasó' });
        }
      }
      if (status === 'draft' && currentElection.status === 'closed') {
        return res.status(400).json({ success: false, message: 'Una elección cerrada no puede volver a borrador' });
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
