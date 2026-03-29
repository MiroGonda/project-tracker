import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  fetchAccessConfig, isAdmin, canAdminister,
  getAccessibleBoardIds, saveAccessConfig,
} from '../api/access'
import { getGoogleEmail, isGoogleConnected } from '../api/google'

const AccessContext = createContext()

export function AccessProvider({ children }) {
  const [config,  setConfigState] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error,   setError]       = useState(null)
  const [email,   setEmail]       = useState(() => isGoogleConnected() ? getGoogleEmail() : null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const c = await fetchAccessConfig()
      setConfigState(c)
    } catch (e) {
      setError(e.message)
      setConfigState({ admins: [], boards: {} })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [])

  /** Call after Google connect/disconnect to re-evaluate permissions. */
  const refreshEmail = useCallback(() => {
    setEmail(isGoogleConnected() ? getGoogleEmail() : null)
  }, [])

  /** Persist config change and update context state immediately. */
  const updateConfig = useCallback((next) => {
    saveAccessConfig(next)
    setConfigState(next)
  }, [])

  const admin         = isAdmin(config, email)
  const canAdmin      = canAdminister(config, email)
  const accessibleIds = getAccessibleBoardIds(config, email)

  return (
    <AccessContext.Provider value={{
      config, updateConfig,
      loading, error,
      email, refreshEmail,
      admin, canAdmin,
      accessibleIds,
      reload,
    }}>
      {children}
    </AccessContext.Provider>
  )
}

export const useAccess = () => useContext(AccessContext)
