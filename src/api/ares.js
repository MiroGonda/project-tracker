import axios from 'axios'

function getConfig() {
  return {
    host:   localStorage.getItem('ares_host')    || '',
    apiKey: localStorage.getItem('ares_api_key') || '',
    rtHost: localStorage.getItem('raintool_host') || 'https://hailstorm.frostdesigngroup.com',
  }
}

function aresClient() {
  const { host, apiKey } = getConfig()
  return axios.create({
    baseURL: `${host}/api/v1/trello`,
    headers: { 'X-API-Key': apiKey },
    timeout: 20000,
  })
}

function rtClient() {
  const { rtHost } = getConfig()
  return axios.create({
    baseURL: `${rtHost}/public/api`,
    timeout: 20000,
  })
}

/**
 * Returns boards normalised to { id, name, activeCards, doneCards, totalCards }.
 * API returns { ok, data: [ { boardId, projectName, ... } ] }
 * Caches in localStorage for 5 minutes to avoid duplicate calls from Sidebar + Admin.
 */
const BOARDS_CACHE_KEY = 'ares_cache_boards'
const BOARDS_CACHE_TTL = 5 * 60 * 1000

export const listBoards = (force = false) => {
  if (!force) {
    try {
      const raw = localStorage.getItem(BOARDS_CACHE_KEY)
      if (raw) {
        const cached = JSON.parse(raw)
        if (Date.now() - cached.cachedAt < BOARDS_CACHE_TTL) return Promise.resolve(cached.boards)
      }
    } catch { /* fall through */ }
  }
  return aresClient().get('/boards').then(r => {
    const raw = r.data?.data
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.boards) ? raw.boards : [])
    const boards = arr.map(b => ({
      id:          b.boardId,
      name:        b.projectName,
      activeCards: b.activeCards,
      doneCards:   b.doneCards,
      totalCards:  b.totalCards,
    }))
    try { localStorage.setItem(BOARDS_CACHE_KEY, JSON.stringify({ boards, cachedAt: Date.now() })) } catch { /* full */ }
    return boards
  })
}

export const boardSummary = (boardId) =>
  aresClient().get(`/boards/${boardId}/summary`).then(r => r.data?.data)

/**
 * Cards for a board.
 * API params: status (active|done), list, label, page, pageSize.
 */
export const boardCards = (boardId, params = {}) =>
  aresClient().get(`/boards/${boardId}/cards`, { params })
    .then(r => {
      const raw = r.data?.data
      return { data: Array.isArray(raw) ? raw : [], meta: r.data?.meta || {} }
    })

/**
 * Movement events for a board.
 * API params: dateFrom (YYYY-MM-DD), dateTo (YYYY-MM-DD), page, pageSize.
 */
export const boardMovements = (boardId, params = {}) =>
  aresClient().get(`/boards/${boardId}/movements`, { params })
    .then(r => {
      const raw = r.data?.data
      return { data: Array.isArray(raw) ? raw : [], meta: r.data?.meta || {} }
    })

export const cycleTime = (rtProjectId, params = {}) => {
  const utilBase = (localStorage.getItem('util_api_url') || '').replace(/\/$/, '')
  const aresHost = (localStorage.getItem('ares_host')    || '').replace(/\/$/, '')
  const aresKey  =  localStorage.getItem('ares_api_key') || ''

  if (utilBase) {
    // Route through backend proxy to avoid CORS issues with X-API-Key header
    return axios.get(`${utilBase}/api/ares/cycle-time`, {
      params:  { rtProjectId, ...params },
      headers: { 'X-Ares-Api-Key': aresKey, 'X-Ares-Host': aresHost },
      timeout: 30000,
    }).then(r => {
      const raw = r.data?.data
      return { data: Array.isArray(raw) ? raw : [], meta: r.data?.meta || {} }
    })
  }

  // Fallback: direct call (works if Ares server has permissive CORS)
  return aresClient().get('/cycle-time', { params: { rtProjectId, ...params } })
    .then(r => {
      const raw = r.data?.data
      return { data: Array.isArray(raw) ? raw : [], meta: r.data?.meta || {} }
    })
}

export const listRaintoolProjects = () =>
  rtClient().get('/project/list-active-projects')
    .then(r => (r.data?.projects || []).map(p => ({ id: p.ProjectID, name: p.name })))

/**
 * Fetch all tasks for a Raintool project in a date range.
 * Routes through the FastAPI backend proxy to avoid CORS issues with the
 * Raintool report endpoint (which lacks Access-Control-Allow-Origin headers).
 * Returns [{ date, resource, taskId, projectId, projectName, activity, timeSpent: { hours, seconds } }]
 */
export const getRaintoolProjectTasks = (projectId, dateFrom, dateTo) => {
  const utilBase = (localStorage.getItem('util_api_url') || '').replace(/\/$/, '')
  if (!utilBase) throw new Error('Utilization API URL is not configured. Set it in Settings.')
  return axios.get(`${utilBase}/api/raintool/tasks`, {
    params: { projectId, dateFrom, dateTo },
    timeout: 30000,
  }).then(r => Array.isArray(r.data) ? r.data : [])
}
