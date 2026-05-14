const { MongoClient } = require('mongodb');
const { logEvent } = require('../../logging_middleware/index');

let client;
let db;

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/notification_service';

  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db();
    logEvent('info', 'Connected to MongoDB', { uri: mongoUri });

    await db.collection('notifications').createIndex({ studentId: 1, isRead: 1, createdAt: -1 });
    await db.collection('notifications').createIndex({ type: 1, createdAt: -1 });

    return db;
  } catch (error) {
    logEvent('error', 'MongoDB connection failed', { error: error.message });
    throw error;
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not connected. Call connectDB first.');
  }
  return db;
}

async function closeDB() {
  if (client) {
    await client.close();
    logEvent('info', 'MongoDB connection closed');
  }
}

module.exports = {
  connectDB,
  getDB,
  closeDB,
};
