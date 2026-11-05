require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const runMigrations = require('./config/migrate');
const socket = require('./socket');

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 3000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT debe ser un número entre 1 y 65535');
}

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en producción');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'dist')));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/elections', require('./routes/election.routes'));
app.use('/api/audit', require('./routes/audit.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));

app.get('*', (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
});

socket.init(server);

const ElectionModel = require('./models/election.model');
const NotificationModel = require('./models/notification.model');

async function reconcileElectionSchedule() {
  try {
    const changed = await ElectionModel.reconcileSchedule();
    for (const election of changed) {
      const details = await ElectionModel.findById(election.id);
      if (election.status === 'open' && details) {
        await NotificationModel.createForAll('election-opened', 'Elección abierta', `Ya puedes participar en: ${details.title}`, details.id);
      } else if (election.status === 'closed' && details) {
        await NotificationModel.createForAll('election-closed', 'Elección cerrada', `Finalizó la votación: ${details.title}`, details.id);
      }
    }

    const dueReminders = await NotificationModel.findDueReminders();
    for (const election of dueReminders) {
      await NotificationModel.createForAll('closing-soon', 'La votación cierra pronto', `Queda menos de una hora para votar en: ${election.title}`, election.id);
    }

    if (changed.length || dueReminders.length) socket.emitNotificationsChanged();
    if (changed.length) socket.emitElectionsChanged();
  } catch (err) {
    console.error('Error al sincronizar calendarios de votación:', err.message);
  }
}

async function start() {
  try {
    await runMigrations();
    await reconcileElectionSchedule();
    setInterval(reconcileElectionSchedule, 30_000).unref();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`App + API escuchando en el puerto ${PORT}`);
      console.log(`Swagger disponible en /api-docs`);
    });
  } catch (err) {
    console.error('Error al iniciar:', err.message);
    process.exit(1);
  }
}

start();
