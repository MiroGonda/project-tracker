import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { onSnapshot } from 'firebase/firestore'
import { auth } from '../firebase'
import {
  ACCESS_DOC, isAdmin, canAdminister,
  getAccessibleBoardIds, saveAccessConfig, getUserBoardRole,
} from '../api/access'
import { fetchUserPrefs, saveUserPrefs } from '../api/userPrefs'
import { listBoards } from '../api/phobos'

const AccessContext = createContext()

function seedLocalStorage(c) {
  const svc = c.services || {}
  const phHost   = svc.phobosHost   || svc.aresHost   || ''
  const phApiKey = svc.phobosApiKey || svc.aresApiKey || ''
  if (phHost)           localStorage.setItem('phobos_host',    phHost)
  if (phApiKey)         localStorage.setItem('phobos_api_key', phApiKey)
  if (svc.trelloApiKey) localStorage.setItem('trello_api_key', svc.trelloApiKey)
  if (svc.trelloToken)  localStorage.setItem('trello_token',   svc.trelloToken)
  // raintool_host seeding removed 2026-04-28 (Phase 0d Raintool removal).
}

export function AccessProvider({ children }) {
  const [config,      setConfigState] = useState(null)
  const [configReady, setConfigReady] = useState(false)
  const [authReady,   setAuthReady]   = useState(false)
  const [error,       setError]       = useState(null)
  const [email,       setEmail]       = useState(null)
  const [hiddenIds,   setHiddenIds]   = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('hidden_board_ids') || '[]')) }
    catch { return new Set() }
  })

  // Phobos /boards list — single fetch hoisted from Sidebar/Settings/Admin to
  // dedupe the cold-cache race that fired multiple parallel requests on full
  // page load. Phobos's 5-min localStorage cache in api/phobos.js stays as
  // defense-in-depth; this layer ensures consumers share one in-flight call.
  const [apiBoards,        setApiBoards]        = useState([])
  const [apiBoardsLoading, setApiBoardsLoading] = useState(false)
  const [apiBoardsError,   setApiBoardsError]   = useState(null)
  const apiBoardsInflight  = useRef(null)  // shared Promise — null when no fetch is active

  // Track Firebase Auth state; seed user preferences from Firestore on login
  // Also track authUser so the onSnapshot can re-subscribe when auth changes
  const [authUser, setAuthUser] = useState(undefined) // undefined = not yet resolved
  useEffect(() => {
    return onAuthStateChanged(auth, async user => {
      setAuthUser(user || null)
      setEmail(user?.email || null)
      setAuthReady(true)
      if (user?.email) {
        try {
          const prefs = await fetchUserPrefs(user.email)
          if (Array.isArray(prefs.hiddenBoardIds)) {
            localStorage.setItem('hidden_board_ids', JSON.stringify(prefs.hiddenBoardIds))
            setHiddenIds(new Set(prefs.hiddenBoardIds))
          }
          if (prefs.passTracking && typeof prefs.passTracking === 'object')
            localStorage.setItem('pass_tracking', JSON.stringify(prefs.passTracking))
        } catch { /* non-fatal */ }
      }
    })
  }, [])

  // Real-time listener on config/access — re-subscribes when auth state changes
  // so that a fresh login in incognito gets a new listener with valid credentials.
  useEffect(() => {
    if (authUser === undefined) return // auth not yet resolved
    setConfigReady(false)
    const unsub = onSnapshot(
      ACCESS_DOC,
      snap => {
        const c = snap.exists() ? snap.data() : { admins: [], boards: {} }
        seedLocalStorage(c)
        setConfigState(c)
        setError(null)
        setConfigReady(true)
      },
      err => {
        console.error('AccessContext snapshot error:', err)
        setError(err.message)
        // Only fall back to empty config if user is not authenticated;
        // an authenticated user hitting an error is a real problem, not bootstrap.
        if (!authUser) {
          setConfigState({ admins: [], boards: {} })
        }
        setConfigReady(true)
      },
    )
    return unsub
  }, [authUser])

  /** Manual reload — kept for callers that explicitly want to re-fetch. */
  const reload = useCallback(() => {
    // The onSnapshot listener keeps config current automatically.
    // This is a no-op but preserved so existing call sites don't break.
  }, [])

  /** No-op: Firebase Auth state updates reactively via onAuthStateChanged. */
  const refreshEmail = useCallback(() => {}, [])

  /** Toggle a board's visibility and persist to localStorage + Firestore. */
  const toggleBoardHidden = useCallback((id) => {
    setHiddenIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      const arr = [...next]
      localStorage.setItem('hidden_board_ids', JSON.stringify(arr))
      saveUserPrefs(email, { hiddenBoardIds: arr }).catch(() => {})
      return next
    })
  }, [email])

  /** Optimistically update local state, then persist to Firestore. */
  const updateConfig = useCallback((next) => {
    setConfigState(next)
    saveAccessConfig(next).catch(e => console.error('Failed to save config:', e))
  }, [])

  /**
   * Fetch the Phobos board list and store on context. Concurrent callers share
   * the same in-flight Promise (dedupe). Pass force=true to bypass the
   * phobos.js localStorage cache (e.g., Admin's "Load Ares boards" button).
   * Resolves to a deduped boards array on success; rejects on failure (callers
   * that don't care about errors can `.catch(() => {})`).
   */
  const refreshApiBoards = useCallback((force = false) => {
    if (apiBoardsInflight.current && !force) return apiBoardsInflight.current
    const host = localStorage.getItem('phobos_host')    || localStorage.getItem('ares_host')
    const key  = localStorage.getItem('phobos_api_key') || localStorage.getItem('ares_api_key')
    if (!host || !key) return Promise.resolve([])
    setApiBoardsLoading(true)
    setApiBoardsError(null)
    const p = listBoards(force)
      .then(boards => {
        const seen = new Set()
        const deduped = (boards || []).filter(b => {
          if (!b?.id || seen.has(b.id)) return false
          seen.add(b.id)
          return true
        })
        setApiBoards(deduped)
        setApiBoardsLoading(false)
        apiBoardsInflight.current = null
        return deduped
      })
      .catch(e => {
        setApiBoardsError(e?.message || 'Failed to load boards')
        setApiBoardsLoading(false)
        apiBoardsInflight.current = null
        throw e
      })
    apiBoardsInflight.current = p
    return p
  }, [])

  // Auto-fetch once when config first loads (credentials are seeded by then).
  // Subsequent re-mounts of Sidebar/Settings reuse the context state without
  // refetching; Admin's button calls refreshApiBoards(true) to force.
  useEffect(() => {
    if (!configReady) return
    refreshApiBoards().catch(() => { /* error surfaced via apiBoardsError */ })
  }, [configReady, refreshApiBoards])

  const loading       = !authReady || !configReady
  const admin         = isAdmin(config, email)
  const canAdmin      = canAdminister(config, email)
  const accessibleIds = getAccessibleBoardIds(config, email)
  const getBoardRole  = useCallback((boardId) => getUserBoardRole(config, email, boardId), [config, email])

  return (
    <AccessContext.Provider value={{
      config, updateConfig,
      loading, error,
      email, refreshEmail,
      admin, canAdmin,
      accessibleIds,
      getBoardRole,
      reload,
      hiddenIds, toggleBoardHidden,
      apiBoards, apiBoardsLoading, apiBoardsError, refreshApiBoards,
    }}>
      {children}
    </AccessContext.Provider>
  )
}

export const useAccess = () => useContext(AccessContext)
