const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

export function isGoogleConfigured() {
  return !!localStorage.getItem('google_client_id')
}

export function isGoogleConnected() {
  const token  = localStorage.getItem('google_access_token')
  const expiry = localStorage.getItem('google_token_expiry')
  if (!token || !expiry) return false
  return new Date(expiry) > new Date()
}

export function getGoogleEmail() {
  return localStorage.getItem('google_user_email') || null
}

export function disconnectGoogle() {
  localStorage.removeItem('google_access_token')
  localStorage.removeItem('google_token_expiry')
  localStorage.removeItem('google_user_email')
}

/**
 * Initiates a GIS token request popup.
 * Must be called from a user gesture (button click).
 */
export function connectGoogle({ onSuccess, onError }) {
  const clientId = localStorage.getItem('google_client_id')
  if (!clientId) {
    onError('No Google Client ID configured. Add it in Settings.')
    return
  }
  if (!window.google?.accounts?.oauth2) {
    onError('Google Identity Services library not loaded. Check your internet connection.')
    return
  }

  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: async (tokenResponse) => {
      if (tokenResponse.error) {
        onError(tokenResponse.error_description || tokenResponse.error)
        return
      }
      const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      localStorage.setItem('google_access_token', tokenResponse.access_token)
      localStorage.setItem('google_token_expiry', expiresAt)

      try {
        const res  = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const info = await res.json()
        localStorage.setItem('google_user_email', info.email || '')
        onSuccess({ access_token: tokenResponse.access_token, email: info.email })
      } catch {
        onSuccess({ access_token: tokenResponse.access_token, email: '' })
      }
    },
  })
  client.requestAccessToken({ prompt: 'consent' })
}
