export const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3344' : ''

export async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}
