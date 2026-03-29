// Access config is fetched from public/access-config.json (committed to repo).
// Admins can override it locally via the Admin page — stored in localStorage.
// To make changes permanent, export the JSON and commit it.

const CONFIG_URL = `${import.meta.env.BASE_URL}access-config.json`
const LS_KEY     = 'ares_access_config_override'

export async function fetchAccessConfig() {
  const override = localStorage.getItem(LS_KEY)
  if (override) {
    try { return JSON.parse(override) } catch {}
  }
  const res = await fetch(`${CONFIG_URL}?_=${Date.now()}`)
  if (!res.ok) throw new Error(`Could not load access-config.json (${res.status})`)
  return res.json()
}

export function saveAccessConfig(config) {
  localStorage.setItem(LS_KEY, JSON.stringify(config, null, 2))
}

export function clearAccessOverride() {
  localStorage.removeItem(LS_KEY)
}

export function hasOverride() {
  return !!localStorage.getItem(LS_KEY)
}

/**
 * Bootstrap mode: if no admins are set, any logged-in user can administer.
 * Once the first admin is saved, only those emails can access /admin.
 */
export function canAdminister(config, email) {
  if (!config) return false
  if (!config.admins?.length) return !!email   // bootstrap: anyone logged in
  return config.admins.includes(email)
}

export function isAdmin(config, email) {
  if (!email || !config?.admins?.length) return false
  return config.admins.includes(email)
}

/**
 * Returns a Set of board IDs the user can see.
 * Admins see everything that is listed under config.boards.
 * '*' in users means all authenticated users.
 */
export function getAccessibleBoardIds(config, email) {
  if (!config?.boards) return new Set()
  if (isAdmin(config, email)) return new Set(Object.keys(config.boards))
  const ids = new Set()
  for (const [id, board] of Object.entries(config.boards)) {
    const users = board.users ?? []
    if (users.includes('*') || (email && users.includes(email))) ids.add(id)
  }
  return ids
}
