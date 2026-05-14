require('dotenv').config();
const axios = require('axios');
const { topPriorityNotifications } = require('./utils/priority');

const NOTIFICATION_API_URL = process.env.NOTIFICATION_API_URL || 'http://4.224.186.213/evaluation-service/notifications';
const authToken = process.env.NOTIFICATION_API_TOKEN || process.argv[2];

if (!authToken) {
  console.error('ERROR: Missing notification API token. Provide NOTIFICATION_API_TOKEN or token as first argument.');
  process.exit(1);
}

async function fetchNotifications(token) {
  const response = await axios.get(NOTIFICATION_API_URL, {
    headers: {
      Authorization: token,
      Accept: 'application/json',
    },
    timeout: 10000,
  });

  if (!response.data || !Array.isArray(response.data.notifications)) {
    throw new Error('Unexpected notification API response');
  }

  return response.data.notifications.map((item) => ({
    id: item.ID,
    type: item.Type,
    message: item.Message,
    timestamp: item.Timestamp,
  }));
}

async function main() {
  try {
    const notifications = await fetchNotifications(authToken);
    const topNotifications = topPriorityNotifications(notifications, 10);

    console.log('Top 10 priority notifications:');
    topNotifications.forEach((notification, index) => {
      console.log(`\n${index + 1}. [${notification.type}] ${notification.message}`);
      console.log(`   ID: ${notification.id}`);
      console.log(`   Timestamp: ${notification.timestamp}`);
    });
  } catch (error) {
    console.error('Failed to fetch priority notifications:', error.message);
  }
}

main();
