const { Server } = require('socket.io');
let io;

function init(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });
  io.on('connection', (socket) => {
    socket.on('join', (electionId) => socket.join(`election:${electionId}`));
    socket.on('leave', (electionId) => socket.leave(`election:${electionId}`));
  });
  return io;
}

const emitResults = (electionId, results) =>
  io?.to(`election:${electionId}`).emit('results:update', { electionId, ...results });
const emitElectionsChanged = () => io?.emit('elections:changed');

module.exports = { init, emitResults, emitElectionsChanged };
