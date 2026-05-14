const axios = require('axios');

const DEFAULT_API_URL = process.env.NOTIFICATION_API_URL || 'http://4.224.186.213/evaluation-service/notifications';

async function getExternalNotifications(authHeader) {
  if (!authHeader) {
    const err = new Error('Authorization header is required to fetch external notifications');
    err.status = 401;
    throw err;
  }

  const response = await axios.get(DEFAULT_API_URL, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
    timeout: 10000,
  });

  if (!response.data || !Array.isArray(response.data.notifications)) {
    const err = new Error('Unexpected response from notification API');
    err.status = 502;
    throw err;
  }

  return response.data.notifications.map((item) => ({
    id: item.ID || item.id,
    type: item.Type || item.type,
    message: item.Message || item.message,
    timestamp: item.Timestamp || item.timestamp,
  }));
}

module.exports = {
  getExternalNotifications,
};
