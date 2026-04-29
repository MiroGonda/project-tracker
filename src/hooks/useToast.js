import { useState, useCallback, useMemo } from 'react'

let _id = 0

export default function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type, duration }])
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Memoize so consumers can safely include `toast` in useEffect deps without
  // triggering re-subscribe loops on every render.
  const toast = useMemo(() => ({
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error',   dur),
    info:    (msg, dur) => addToast(msg, 'info',    dur),
  }), [addToast])

  return { toasts, toast, dismiss }
}
