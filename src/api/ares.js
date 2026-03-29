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

export const listBoards = () =>
  aresClient().get('/boards').then(r => {
    const data = r.data?.data
    return (data?.boards ?? data) || []
  })

export const boardSummary = (boardId) =>
  aresClient().get(`/boards/${boardId}/summary`).then(r => r.data?.data)

export const boardCards = (boardId, params = {}) =>
  aresClient().get(`/boards/${boardId}/cards`, { params })
    .then(r => ({ data: r.data?.data, meta: r.data?.meta || {} }))

export const boardMovements = (boardId, params = {}) =>
  aresClient().get(`/boards/${boardId}/movements`, { params })
    .then(r => ({ data: r.data?.data, meta: r.data?.meta || {} }))

export const cycleTime = (rtProjectId, params = {}) =>
  aresClient().get('/cycle-time', { params: { rtProjectId, ...params } })
    .then(r => ({ data: r.data?.data, meta: r.data?.meta || {} }))

export const listRaintoolProjects = () =>
  rtClient().get('/project/list-active-projects')
    .then(r => (r.data?.projects || []).map(p => ({ id: p.ProjectID, name: p.name })))
