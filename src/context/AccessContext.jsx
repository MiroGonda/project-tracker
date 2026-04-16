import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { onSnapshot } from 'firebase/firestore'
import { auth } from '../firebase'
import {
  ACCESS_DOC, isAdmin, canAdminister,
  getAccessibleBoardIds, saveAccessConfig, getUserBoardRole,
} from '../api/access'
import { fetchUserPrefs, saveUserPrefs } from '../api/userPrefs'

const AccessContext = createContext()

function seedLocalStorage(c) {
  const svc = c.services || {}
  const phHost   = svc.phobosHost   || svc.aresHost   || ''
  const phApiKey = svc.phobosApiKey || svc.aresApiKey || ''
  if (phHost)           localStorage.setItem('phobos_host',    phHost)
  if (phApiKey)         localStorage.setItem('phobos_api_key', phApiKey)
  if (svc.raintoolHost) localStorage.setItem('raintool_host',  svc.raintoolHost)
  if (svc.trelloApiKey) localStorage.setItem('trello_api_key', svc.trelloApiKey)
  if (svc.trelloToken)  localStorage.setItem('trello_token',   svc.trelloToken)
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

  // Track Firebase Auth state; seed user preferences from Firestore on login
  useEffect(() => {
    return onAuthStateChanged(auth, async user => {
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

  // Real-time listener on config/access — all users see access changes immediately
  useEffect(() => {
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
        setConfigState({ admins: [], boards: {} })
        setConfigReady(true)
      },
    )
    return unsub
  }, [])

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
    }}>
      {children}
    </AccessContext.Provider>
  )
}

export const useAccess = () => useContext(AccessContext)
