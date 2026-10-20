/**
 * Старт OIDC через backend BFF (не раскрывает client_secret).
 */

const API_BASE = import.meta.env.VITE_API_URL || ''

export function buildOidcLoginUrl({ redirect = '/', prompt } = {}) {
  const q = new URLSearchParams()
  q.set('redirect', redirect || '/')
  if (prompt) q.set('prompt', prompt)
  return `${API_BASE}/api/auth/oidc/login?${q.toString()}`
}

export function startOidcLogin(opts) {
  window.location.assign(buildOidcLoginUrl(opts))
}

export function parseOidcCallbackHash(hash) {
  const raw = (hash || '').startsWith('#') ? hash.slice(1) : hash || ''
  const params = new URLSearchParams(raw)
  const access_token = params.get('access_token') || ''
  let redirect = params.get('redirect') || '/'
  if (!redirect.startsWith('/') || redirect.startsWith('//')) redirect = '/'
  return { access_token, redirect }
}
