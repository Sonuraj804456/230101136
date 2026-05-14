const express = require('express');
const { getNotifications, createNotification, markAsRead, getPriorityNotifications, saveNotifications } = require('../services/notificationService');
const { getExternalNotifications } = require('../adapters/externalNotificationApi');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const filters = {
      studentId: req.query.studentId,
      status: req.query.status,
      type: req.query.type,
      limit: Number(req.query.limit) || 50,
    };
    const notifications = await getNotifications(filters);
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { studentId, type, message, timestamp } = req.body;
    if (!studentId || !type || !message) {
      return res.status(400).json({ error: 'studentId, type, and message are required' });
    }
    const notification = await createNotification({ studentId, type, message, timestamp });
    res.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await markAsRead(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ notification });
  } catch (error) {
    next(error);
  }
});

router.get('/priority', async (req, res, next) => {
  try {
    const studentId = req.query.studentId;
    const limit = Number(req.query.limit) || 10;
    const notifications = await getPriorityNotifications({ studentId, limit });
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

router.get('/external', async (req, res, next) => {
  try {
    const token = req.header('Authorization') || process.env.NOTIFICATION_API_TOKEN;
    const notifications = await getExternalNotifications(token);
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

router.post('/import-external', async (req, res, next) => {
  try {
    const token = req.header('Authorization') || process.env.NOTIFICATION_API_TOKEN;
    const notifications = await getExternalNotifications(token);
    const saved = await saveNotifications(notifications);
    res.json({ importedCount: saved.length, notifications: saved });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
