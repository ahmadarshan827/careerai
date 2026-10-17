const API_URL = import.meta.env.VITE_API_URL
const TOKEN_KEY = 'careerai_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    payload = new URLSearchParams(form)
  } else if (body) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(`${API_URL}${path}`, { method, headers, body: payload })

  if (!res.ok) {
    let message = 'Something went wrong'
    try {
      const data = await res.json()
      message = typeof data.detail === 'string' ? data.detail : 'Invalid input'
    } catch {
      // response had no JSON body
    }
    const error = new Error(message)
    error.status = res.status
    throw error
  }
  return res.json()
}