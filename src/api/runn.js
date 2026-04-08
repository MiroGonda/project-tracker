import axios from 'axios'

function getUtilApiBase() {
  return (localStorage.getItem('util_api_url') || '').replace(/\/$/, '')
}

/** Runn API key — stored in Settings, forwarded to the backend as a header. */
function getRunnApiKey() {
  return localStorage.getItem('runn_api_key') || ''
}

/** Extra headers sent to our backend so it can use the user's Runn key. */
function authHeaders() {
  const key = getRunnApiKey()
  return key ? { 'X-Runn-Api-Key': key } : {}
}

export function isUtilApiConfigured() {
  return !!getUtilApiBase()
}

/**
 * Fetch pre-computed utilization data from the backend.
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 * @param {number|null} projectId  Optional Runn project ID to scope the report
 */
export async function getUtilization(startDate, endDate, projectId = null) {
  const base = getUtilApiBase()
  if (!base) throw new Error('Utilization API URL is not configured. Set it in Settings.')
  const params = { startDate, endDate }
  if (projectId != null) params.projectId = projectId
  const r = await axios.get(`${base}/api/runn/utilization`, {
    params,
    headers: authHeaders(),
    timeout: 30000,
  })
  return r.data
}

/**
 * Fetch all Runn projects for the project filter dropdown.
 * Returns [{ id, name }, ...]
 */
export async function getRunnProjects() {
  const base = getUtilApiBase()
  if (!base) throw new Error('Utilization API URL is not configured.')
  const r = await axios.get(`${base}/api/runn/projects`, {
    headers: authHeaders(),
    timeout: 15000,
  })
  return Array.isArray(r.data) ? r.data : []
}

/**
 * Ping the backend connectivity check endpoint.
 */
export async function checkUtilizationApi() {
  const base = getUtilApiBase()
  if (!base) throw new Error('Utilization API URL is not configured.')
  const r = await axios.get(`${base}/api/runn/me`, {
    headers: authHeaders(),
    timeout: 10000,
  })
  return r.data
}
