const axios = require('axios');

const DEPOT_API_URL = process.env.DEPOT_API_URL || 'http://4.224.186.213/evaluation-service/depots';
const VEHICLES_API_URL = process.env.VEHICLES_API_URL || 'http://4.224.186.213/evaluation-service/vehicles';

async function getDepots(authHeader) {
  if (!authHeader) {
    const err = new Error('Authorization header is required to fetch depots');
    err.status = 401;
    throw err;
  }

  const response = await axios.get(DEPOT_API_URL, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
    timeout: 10000,
  });

  return response.data;
}

async function getVehicles(authHeader) {
  if (!authHeader) {
    const err = new Error('Authorization header is required to fetch vehicles');
    err.status = 401;
    throw err;
  }

  const response = await axios.get(VEHICLES_API_URL, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
    timeout: 10000,
  });

  return response.data;
}

module.exports = {
  getDepots,
  getVehicles,
};
