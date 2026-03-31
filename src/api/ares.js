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
 */
export const listBoards = () =>
  aresClient().get('/boards').then(r => {
    const raw = r.data?.data
    // Guard: handle array, object-with-boards, or anything unexpected
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.boards) ? raw.boards : [])
    return arr.map(b => ({
      id:          b.boardId,
      name:        b.projectName,
      activeCards: b.activeCards,
      doneCards:   b.doneCards,
      totalCards:  b.totalCards,
    }))
  })

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

export const cycleTime = (rtProjectId, params = {}) =>
  aresClient().get('/cycle-time', { params: { rtProjectId, ...params } })
    .then(r => {
      const raw = r.data?.data
      return { data: Array.isArray(raw) ? raw : [], meta: r.data?.meta || {} }
    })

export const listRaintoolProjects = () =>
  rtClient().get('/project/list-active-projects')
    .then(r => (r.data?.projects || []).map(p => ({ id: p.ProjectID, name: p.name })))
