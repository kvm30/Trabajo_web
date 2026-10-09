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
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'))); // Frontend

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/elections', require('./routes/election.routes'));
app.use('/api/audit', require('./routes/audit.routes'));

socket.init(server);

async function start() {
  try {
    await runMigrations();
    server.listen(PORT, () => {
      console.log(`App + API en http://localhost:${PORT}`);
      console.log(`Swagger en   http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    console.error('Error al iniciar:', err.message);
    process.exit(1);
  }
}

start();
