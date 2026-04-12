import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import {
  fetchAccessConfig, isAdmin, canAdminister,
  getAccessibleBoardIds, saveAccessConfig, getUserBoardRole,
} from '../api/access'

const AccessContext = createContext()

export function AccessProvider({ children }) {
  const [config,    setConfigState] = useState(null)
  const [configReady, setConfigReady] = useState(false)
  const [authReady,   setAuthReady]   = useState(false)
  const [error,     setError]       = useState(null)
  const [email,     setEmail]       = useState(null)

  // Track Firebase Auth state
  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setEmail(user?.email || null)
      setAuthReady(true)
    })
  }, [])

  const reload = useCallback(async () => {
    setConfigReady(false)
    setError(null)
    try {
      const c = await fetchAccessConfig()
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
