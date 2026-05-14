const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../utils/db');
const { topPriorityNotifications } = require('../utils/priority');

async function getNotifications(filters = {}) {
  const db = getDB();
  const query = {};

  if (filters.studentId) {
    query.studentId = String(filters.studentId);
  }
  if (filters.status === 'unread') {
    query.isRead = false;
  }
  if (filters.type) {
    query.type = filters.type;
  }

  const notificationsCursor = db
    .collection('notifications')
    .find(query)
    .sort({ createdAt: -1 });

  if (filters.limit && Number(filters.limit) > 0) {
    notificationsCursor.limit(Number(filters.limit));
  }

  const notifications = await notificationsCursor.toArray();

  return notifications;
}

async function createNotification({ studentId, type, message, timestamp }) {
  const db = getDB();
  const notification = {
    _id: uuidv4(),
    id: uuidv4(),
    studentId: String(studentId),
    type,
    message,
    timestamp: timestamp || new Date().toISOString(),
    isRead: false,
    createdAt: new Date(),
  };

  await db.collection('notifications').insertOne(notification);
  return notification;
}

async function markAsRead(id) {
  const db = getDB();
  const result = await db
    .collection('notifications')
    .findOneAndUpdate({ id }, { $set: { isRead: true } }, { returnDocument: 'after' });

  return result.value;
}

async function saveNotifications(notifications) {
  const db = getDB();
  const ops = notifications.map((notification) => {
    const record = {
      $set: {
        id: notification.id || uuidv4(),
        studentId: notification.studentId ? String(notification.studentId) : 'external',
        type: notification.type || 'Event',
        message: notification.message || '',
        timestamp: notification.timestamp || new Date().toISOString(),
        isRead: notification.isRead ?? false,
        createdAt: notification.createdAt ? new Date(notification.createdAt) : new Date(notification.timestamp || undefined),
      },
    };

    return {
      updateOne: {
        filter: { id: record.$set.id },
        update: { $setOnInsert: record.$set, $set: record.$set },
        upsert: true,
      },
    };
  });

  if (ops.length === 0) {
    return [];
  }

  await db.collection('notifications').bulkWrite(ops, { ordered: false });
  return notifications.map((notification) => ({
    id: notification.id,
    studentId: notification.studentId ? String(notification.studentId) : 'external',
    type: notification.type || 'Event',
    message: notification.message || '',
    timestamp: notification.timestamp || new Date().toISOString(),
    isRead: notification.isRead ?? false,
  }));
}

async function getPriorityNotifications({ studentId, limit = 10 }) {
  const list = await getNotifications({ studentId, status: 'unread' });
  return topPriorityNotifications(list, limit);
}

module.exports = {
  getNotifications,
  createNotification,
  markAsRead,
  getPriorityNotifications,
};
