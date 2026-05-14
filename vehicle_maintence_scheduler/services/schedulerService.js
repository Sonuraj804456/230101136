const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../../notification_app_be/utils/db');

function selectVehicles(vehicles, availableHours) {
  const sorted = [...vehicles].sort((a, b) => {
    const ratioA = (a.Impact ?? a.impact ?? 0) / (a.Duration ?? a.duration ?? 1);
    const ratioB = (b.Impact ?? b.impact ?? 0) / (b.Duration ?? b.duration ?? 1);
    return ratioB - ratioA;
  });

  const selected = [];
  let remaining = availableHours;

  for (const item of sorted) {
    const duration = item.Duration ?? item.duration ?? 0;
    if (duration <= remaining) {
      selected.push(item);
      remaining -= duration;
    }
  }

  return selected;
}

async function saveSchedule({ availableHours, depotId, vehicles, selected }) {
  const db = getDB();
  const record = {
    _id: uuidv4(),
    id: uuidv4(),
    createdAt: new Date(),
    availableHours,
    depotId: depotId ? String(depotId) : null,
    vehicleCount: vehicles.length,
    selectedCount: selected.length,
    totalImpact: selected.reduce((sum, item) => sum + (item.Impact ?? item.impact ?? 0), 0),
    totalDuration: selected.reduce((sum, item) => sum + (item.Duration ?? item.duration ?? 0), 0),
    vehicles: selected.map((item) => ({
      id: item.TaskID || item.id || item.TaskId || uuidv4(),
      duration: item.Duration ?? item.duration,
      impact: item.Impact ?? item.impact,
      raw: item,
    })),
  };

  await db.collection('vehicle_schedules').insertOne(record);
  return record;
}

async function getScheduleHistory(limit = 20) {
  const db = getDB();
  return db
    .collection('vehicle_schedules')
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

module.exports = {
  selectVehicles,
  saveSchedule,
  getScheduleHistory,
};
