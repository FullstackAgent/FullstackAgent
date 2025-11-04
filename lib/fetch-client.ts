/**
 * Type-Safe Fetch Client with Auto 401 Handling
 *
 * Simple, type-safe HTTP client wrapper around native fetch API.
 * Automatically handles authentication errors by clearing cookies and redirecting.
 *
 * @example
 * ```typescript
 * import { GET, POST, PUT, DELETE } from '@/lib/fetch-client'
 *
 * // GET request
 * const projects = await GET<Project[]>('/api/projects')
 *
 * // POST with body
 * const newProject = await POST<Project>('/api/projects', {
 *   name: 'My Project',
 *   description: 'A cool project'
 * })
 *
 * // PUT with body
 * const updated = await PUT<Project>(`/api/projects/${id}`, { name: 'Updated' })
 *
 * // DELETE
 * await DELETE(`/api/projects/${id}`)
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Request configuration options
 */
export interface FetchConfig extends Omit<RequestInit, 'method' | 'body'> {
  /**
   * Query parameters to append to URL
   * @example { page: 1, limit: 10 } → ?page=1&limit=10
   */
  params?: Record<string, string | number | boolean | undefined | null>

  /**
   * Timeout in milliseconds (0 = no timeout)
   * @default 30000 (30 seconds)
   */
  timeout?: number

  /**
   * Skip 401 auto-redirect (for special cases)
   * @default false
   */
  skipAuthRedirect?: boolean
}

/**
 * Custom error class for HTTP errors
 */
export class FetchError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    super(`HTTP ${status}: ${statusText}`)
    this.name = 'FetchError'
  }
}

// ============================================================================
// Cookie Management
// ============================================================================

/**
 * Clear all NextAuth authentication cookies
 */
function clearAuthCookies(): void {
  const cookieNames = [
    'next-auth.session-token',
    'next-auth.callback-url',
    'next-auth.csrf-token',
    '__Secure-next-auth.session-token',
    '__Host-next-auth.csrf-token',
  ]

  const domain = window.location.hostname
  const expireDate = 'Thu, 01 Jan 1970 00:00:00 UTC'

  cookieNames.forEach((name) => {
    document.cookie = `${name}=; expires=${expireDate}; path=/; domain=${domain}; SameSite=None; Secure`
    document.cookie = `${name}=; expires=${expireDate}; path=/; SameSite=None; Secure`
    document.cookie = `${name}=; expires=${expireDate}; path=/;`
  })
}

/**
 * Handle 401 Unauthorized response
 */
function handle401Unauthorized(): void {
  console.warn('[fetch-client] 401 Unauthorized - redirecting to /')
  clearAuthCookies()
  window.location.href = '/'
}

// ============================================================================
// Core Request Function
// ============================================================================

/**
 * Build URL with query parameters
 */
function buildUrl(url: string, params?: FetchConfig['params']): string {
  if (!params) return url

  const urlObj = new URL(url, window.location.origin)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      urlObj.searchParams.append(key, String(value))
    }
  })

  return urlObj.toString()
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  if (timeoutMs <= 0) {
    return fetch(url, init)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Core request function
 */
async function request(
  method: string,
  url: string,
  body?: unknown,
  config?: FetchConfig
): Promise<Response> {
  // Build URL with query params
  const fullUrl = buildUrl(url, config?.params)

  // Build headers
  const headers = new Headers(config?.headers)
  if (!headers.has('Content-Type') && body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  // Build body
  let requestBody: BodyInit | undefined
  if (body !== undefined) {
    if (body instanceof FormData || body instanceof Blob) {
      requestBody = body
      // Remove Content-Type for FormData (browser sets boundary)
      headers.delete('Content-Type')
    } else if (typeof body === 'string') {
      requestBody = body
    } else {
      requestBody = JSON.stringify(body)
    }
  }

  // Build fetch init
  const init: RequestInit = {
    method,
    headers,
    body: requestBody,
    credentials: config?.credentials ?? 'same-origin',
    cache: config?.cache,
    redirect: config?.redirect,
    referrer: config?.referrer,
    referrerPolicy: config?.referrerPolicy,
    integrity: config?.integrity,
    keepalive: config?.keepalive,
    mode: config?.mode,
  }

  try {
    // Execute fetch with timeout
    const timeout = config?.timeout ?? 30000
    const response = await fetchWithTimeout(fullUrl, init, timeout)

    // Handle 401 Unauthorized
    if (response.status === 401 && !config?.skipAuthRedirect) {
      handle401Unauthorized()
      return response
    }

    // Handle HTTP errors
    if (!response.ok) {
      let errorBody: unknown
      const contentType = response.headers.get('content-type')

      try {
        if (contentType?.includes('application/json')) {
          errorBody = await response.json()
        } else {
          errorBody = await response.text()
        }
      } catch {
        errorBody = null
      }

      throw new FetchError(response.status, response.statusText, errorBody)
    }

    return response
  } catch (error) {
    if (error instanceof FetchError) {
      throw error
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${config?.timeout ?? 30000}ms`)
    }

    throw error
  }
}

/**
 * Parse JSON response
 */
async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  try {
    return JSON.parse(text) as T
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error}`)
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * GET request
 */
export async function GET<T = unknown>(url: string, config?: FetchConfig): Promise<T> {
  const response = await request('GET', url, undefined, config)
  return parseJson<T>(response)
}

/**
 * POST request
 */
export async function POST<T = unknown>(
  url: string,
  body?: unknown,
  config?: FetchConfig
): Promise<T> {
  const response = await request('POST', url, body, config)
  return parseJson<T>(response)
}

/**
 * PUT request
 */
export async function PUT<T = unknown>(
  url: string,
  body?: unknown,
  config?: FetchConfig
): Promise<T> {
  const response = await request('PUT', url, body, config)
  return parseJson<T>(response)
}

/**
 * PATCH request
 */
export async function PATCH<T = unknown>(
  url: string,
  body?: unknown,
  config?: FetchConfig
): Promise<T> {
  const response = await request('PATCH', url, body, config)
  return parseJson<T>(response)
}

/**
 * DELETE request
 */
export async function DELETE<T = unknown>(url: string, config?: FetchConfig): Promise<T> {
  const response = await request('DELETE', url, undefined, config)
  return parseJson<T>(response)
}