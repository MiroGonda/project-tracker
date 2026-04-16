import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export const ACCESS_DOC = doc(db, 'config', 'access')

export async function fetchAccessConfig() {
  const snap = await getDoc(ACCESS_DOC)
  if (!snap.exists()) return { admins: [], boards: {} }
  return snap.data()
}

export async function saveAccessConfig(config) {
  await setDoc(ACCESS_DOC, config)
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
 * Frost and external users see their assigned boards.
 * Legacy: '*' in users[] means all authenticated users (treated as frost-level).
 */
export function getAccessibleBoardIds(config, email) {
  if (!config?.boards) return new Set()
  if (isAdmin(config, email)) return new Set(Object.keys(config.boards))
  const ids = new Set()
  for (const [id, board] of Object.entries(config.boards)) {
    const legacy = board.users ?? []
    if (legacy.includes('*') || (email && legacy.includes(email))) { ids.add(id); continue }
    if (email && (board.frostUsers?.includes(email) || board.externalUsers?.includes(email))) ids.add(id)
  }
  return ids
}

/**
 * Returns the user's role on a specific board.
 * 'admin'    — user is in config.admins
 * 'frost'    — user is in board.frostUsers (or legacy users[])
 * 'external' — user is in board.externalUsers
 * null       — no access
 */
export function getUserBoardRole(config, email, boardId) {
  if (!config || !email || !boardId) return null
  if (isAdmin(config, email)) return 'admin'
  const board = config.boards?.[boardId]
  if (!board) return null
  if (board.frostUsers?.includes(email)) return 'frost'
  if (board.externalUsers?.includes(email)) return 'external'
  // Legacy: users[] treated as frost-level
  const legacy = board.users ?? []
  if (legacy.includes('*') || legacy.includes(email)) return 'frost'
  return null
}

/** Admin or frost users can configure board integrations (Raintool). */
export function canConfigureBoard(config, email, boardId) {
  const role = getUserBoardRole(config, email, boardId)
  return role === 'admin' || role === 'frost'
}
