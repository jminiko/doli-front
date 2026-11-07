let known

export function remember(user) {
  known = user
}

export async function ensureUser() {
  if (known !== undefined) {
    return known
  }
  try {
    known = await api('/api/me')
  } catch (cause) {
    known = null
  }
  return known
}

export async function api(path, { locale = 'fr', method = 'GET', body, headers = {} } = {}) {
  const join = path.includes('?') ? '&' : '?'
  const response = await fetch(`${path}${join}lang=${encodeURIComponent(locale)}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...headers,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (response.status === 204) {
    return {}
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/me' && path !== '/api/login') {
      known = null
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    throw new Error(data.error || response.statusText)
  }
  return data
}
