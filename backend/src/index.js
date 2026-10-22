require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const runMigrations = require('./config/migrate');
const ElectionModel = require('./models/election.model');
const NotificationModel = require('./models/notification.model');
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

app.get('*', (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
});

socket.init(server);

async function start() {
  try {
    await runMigrations();
    const runScheduledTasks = async () => {
      const changedIds = await ElectionModel.refreshScheduledStatuses();
      for (const electionId of changedIds) {
        const election = await ElectionModel.findById(electionId);
        if (!election) continue;
        const eventType = election.status === 'open' ? 'opened' : 'results';
        try {
          await NotificationModel.enqueue(electionId, eventType);
        } catch (err) {
          console.error(`No se pudo registrar la notificación para la elección ${electionId}:`, err.message);
        }
      }
      if (changedIds.length) socket.emitElectionsChanged();
      await NotificationModel.enqueueUpcomingClosures();
      await NotificationModel.processPending();
    };
    await runScheduledTasks();
    setInterval(() => {
      runScheduledTasks().catch((err) => {
        console.error('Error al procesar elecciones y notificaciones programadas:', err.message);
      });
    }, 30_000);
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
