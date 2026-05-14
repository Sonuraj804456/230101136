require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requestLogger, errorLogger } = require('../logging_middleware/index');
const { connectDB, closeDB } = require('../notification_app_be/utils/db');
const schedulerRouter = require('./routes/scheduler');

const app = express();
const PORT = process.env.VEHICLE_PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'vehicle_maintence_scheduler', version: '1.0.0' });
});

app.use('/scheduler', schedulerRouter);

app.use(errorLogger);
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Vehicle scheduler service listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start vehicle scheduler:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down vehicle scheduler...');
  await closeDB();
  process.exit(0);
});

startServer();
