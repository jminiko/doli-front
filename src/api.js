import { ref } from 'vue'

let known
export const httpBusy = ref(false)
let pending = 0
let hideTimer = 0

function paintBusy() {
  if (pending > 0) {
    clearTimeout(hideTimer)
    httpBusy.value = true
    return
  }
  hideTimer = setTimeout(() => {
    if (pending < 1) httpBusy.value = false
  }, 120)
}

function beginHttp() {
  pending += 1
  paintBusy()
}

function endHttp() {
  pending = Math.max(0, pending - 1)
  paintBusy()
}

if (typeof window !== 'undefined' && window.fetch && !window.fetch.deskHttpWait) {
  const nativeFetch = window.fetch.bind(window)
  const wrappedFetch = function () {
    beginHttp()
    return nativeFetch.apply(window, arguments).then((response) => {
      endHttp()
      return response
    }, (error) => {
      endHttp()
      throw error
    })
  }
  wrappedFetch.deskHttpWait = true
  window.fetch = wrappedFetch
}

if (typeof window !== 'undefined' && window.XMLHttpRequest && !XMLHttpRequest.prototype.send.deskHttpWait) {
  const nativeSend = XMLHttpRequest.prototype.send
  const wrappedSend = function () {
    if (!this._httpWait) {
      this._httpWait = true
      beginHttp()
      this.addEventListener('loadend', endHttp)
    }
    return nativeSend.apply(this, arguments)
  }
  wrappedSend.deskHttpWait = true
  XMLHttpRequest.prototype.send = wrappedSend
}

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

export function assertUploadSize(file, nav) {
  const max = Number(nav?.uploadMax)
  if (!file || !Number.isFinite(max) || max <= 0) return
  if (file.size > max * 1024 * 1024) {
    throw new Error(nav?.chrome?.['error.uploadTooLarge'] || 'upload')
  }
}

export function assertFormSize(form, nav) {
  const data = form instanceof FormData ? form : new FormData(form)
  for (const value of data.values()) {
    if (typeof File !== 'undefined' && value instanceof File) assertUploadSize(value, nav)
  }
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
