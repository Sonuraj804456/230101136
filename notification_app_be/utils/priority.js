const weightMap = {
  Placement: 100,
  Result: 50,
  Event: 20,
};

function normalizeTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getPriorityScore(notification) {
  const weight = weightMap[notification.type] || 0;
  const recency = normalizeTimestamp(notification.timestamp);
  return weight * 1000000000000 + recency;
}

function topPriorityNotifications(notifications, limit = 10) {
  return notifications
    .map((notification) => ({
      ...notification,
      priorityScore: getPriorityScore(notification),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit)
    .map(({ priorityScore, ...notification }) => notification);
}

module.exports = {
  topPriorityNotifications,
};
