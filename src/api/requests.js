import { db } from '../firebase'
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDocs } from 'firebase/firestore'

const col = (boardId) => collection(db, 'boards', boardId, 'requests')
const ref = (boardId, id) => doc(db, 'boards', boardId, 'requests', id)

/**
 * Subscribe to real-time request updates for a board.
 * Returns the unsubscribe function — caller must invoke it on cleanup.
 */
export function subscribeRequests(boardId, onData, onError) {
  return onSnapshot(
    col(boardId),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err  => onError(err),
  )
}

/** Create or update a single request document. */
export function saveRequest(boardId, request) {
  return setDoc(ref(boardId, request.id), request)
}

/** Delete a single request document. */
export function deleteRequest(boardId, requestId) {
  return deleteDoc(ref(boardId, requestId))
}

/**
 * One-time migration: if localStorage has requests for this board and Firestore
 * doesn't, write them up. Cleans up the localStorage key either way.
 * Fire-and-forget — errors are logged silently.
 */
export async function migrateLocalRequests(boardId) {
  try {
    const raw = localStorage.getItem(`requests_${boardId}`)
    // Remove the key immediately — before any async work — so a second call
    // (e.g. after the user deletes all Firestore requests) can never re-apply stale data.
    localStorage.removeItem(`requests_${boardId}`)
    const local = raw ? JSON.parse(raw) : []
    if (!local.length) return

    const snap = await getDocs(col(boardId))
    if (snap.empty) {
      const VALID_STATUSES = new Set(['open', 'on-hold', 'closed'])
      const normalized = local.map(r => ({
        ...r,
        status: VALID_STATUSES.has(r.status) ? r.status : 'open',
      }))
      await Promise.all(normalized.map(r => setDoc(ref(boardId, r.id), r)))
    }
  } catch (e) {
    console.error('migrateLocalRequests:', e)
  }
}
