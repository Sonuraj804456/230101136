require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requestLogger, errorLogger } = require('../logging_middleware/index');
const { connectDB, closeDB } = require('./utils/db');
const notificationsRouter = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'notification_app_be', version: '1.0.0' });
});

app.use('/notifications', notificationsRouter);

app.use(errorLogger);
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Notification service listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await closeDB();
  process.exit(0);
});

startServer();
