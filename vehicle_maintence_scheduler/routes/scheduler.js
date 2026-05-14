const express = require('express');
const { getDepots, getVehicles } = require('../adapters/evaluationApi');
const { selectVehicles, saveSchedule, getScheduleHistory } = require('../services/schedulerService');

const router = express.Router();

router.get('/depots', async (req, res, next) => {
  try {
    const token = req.header('Authorization') || process.env.NOTIFICATION_API_TOKEN;
    const data = await getDepots(token);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/vehicles', async (req, res, next) => {
  try {
    const token = req.header('Authorization') || process.env.NOTIFICATION_API_TOKEN;
    const data = await getVehicles(token);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post('/schedule', async (req, res, next) => {
  try {
    const { availableHours = 10, depotId } = req.body;
    const token = req.header('Authorization') || process.env.NOTIFICATION_API_TOKEN;
    const vehicleData = await getVehicles(token);
    const vehicles = Array.isArray(vehicleData.vehicles) ? vehicleData.vehicles : vehicleData;
    const selected = selectVehicles(vehicles, Number(availableHours));
    const record = await saveSchedule({ availableHours: Number(availableHours), depotId, vehicles, selected });
    res.json({ schedule: record });
  } catch (error) {
    next(error);
  }
});

router.get('/schedule/history', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const history = await getScheduleHistory(limit);
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
