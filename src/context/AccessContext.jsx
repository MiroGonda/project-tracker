import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import {
  fetchAccessConfig, isAdmin, canAdminister,
  getAccessibleBoardIds, saveAccessConfig, getUserBoardRole,
} from '../api/access'
import { fetchUserPrefs } from '../api/userPrefs'

const AccessContext = createContext()

export function AccessProvider({ children }) {
  const [config,    setConfigState] = useState(null)
  const [configReady, setConfigReady] = useState(false)
  const [authReady,   setAuthReady]   = useState(false)
  const [error,     setError]       = useState(null)
  const [email,     setEmail]       = useState(null)

  // Track Firebase Auth state; seed user preferences from Firestore on login
  useEffect(() => {
    return onAuthStateChanged(auth, async user => {
      setEmail(user?.email || null)
      setAuthReady(true)
      if (user?.email) {
        try {
          const prefs = await fetchUserPrefs(user.email)
          if (Array.isArray(prefs.hiddenBoardIds))
            localStorage.setItem('hidden_board_ids', JSON.stringify(prefs.hiddenBoardIds))
          if (prefs.passTracking && typeof prefs.passTracking === 'object')
            localStorage.setItem('pass_tracking', JSON.stringify(prefs.passTracking))
        } catch { /* non-fatal — localStorage already has any local state */ }
      }
    })
  }, [])

  const reload = useCallback(async () => {
    setConfigReady(false)
    setError(null)
    try {
      const c = await fetchAccessConfig()
      // Seed shared service credentials into localStorage so api modules can read them.
      // Read both new (phobos) and old (ares) field names to handle existing Firestore docs.
      const svc = c.services || {}
      const phHost   = svc.phobosHost   || svc.aresHost   || ''
      const phApiKey = svc.phobosApiKey || svc.aresApiKey || ''
      if (phHost)           localStorage.setItem('phobos_host',    phHost)
      if (phApiKey)         localStorage.setItem('phobos_api_key', phApiKey)
      if (svc.raintoolHost) localStorage.setItem('raintool_host',  svc.raintoolHost)
      if (svc.trelloApiKey) localStorage.setItem('trello_api_key', svc.trelloApiKey)
      if (svc.trelloToken)  localStorage.setItem('trello_token',   svc.trelloToken)
      setConfigState(c)
    } catch (e) {
      setError(e.message)
      setConfigState({ admins: [], boards: {} })
    } finally {
      setConfigReady(true)
    }
  }, [])

  useEffect(() => { reload() }, [])

  /** No-op: Firebase Auth state updates reactively via onAuthStateChanged. */
  const refreshEmail = useCallback(() => {}, [])

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
    }}>
      {children}
    </AccessContext.Provider>
  )
}

export const useAccess = () => useContext(AccessContext)
