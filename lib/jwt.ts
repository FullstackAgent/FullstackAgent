import * as jsonwebtoken from 'jsonwebtoken'
import { z } from 'zod'

export const sealosJWT = z.object({
  workspaceUid: z.string(),
  workspaceId: z.string(),
  regionUid: z.string(),
  userCrUid: z.string(),
  userCrName: z.string(),
  userId: z.string(),
  userUid: z.string(),
  iat: z.number(),
  exp: z.number(),
})

export type SealosJWT = z.infer<typeof sealosJWT>

/**
 * Parse and verify JWT token
 * @param token JWT token string
 * @param secret JWT secret key
 * @returns Parsed JWT payload
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJWT<T = any>(token: string, secret: string): T {
  try {
    const decoded = jsonwebtoken.verify(token, secret) as T
    return decoded
  } catch (error) {
    throw new Error(
      `JWT verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Parse Sealos JWT token specifically
 * @param token Sealos JWT token string
 * @returns Parsed and validated Sealos JWT payload
 */
export function parseSealosJWT(token: string, secret: string): SealosJWT {
  try {
    const decoded = parseJWT(token, secret)
    const validated = sealosJWT.parse(decoded)
    return validated
  } catch (error) {
    throw new Error(
      `Sealos JWT parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Verify JWT token without parsing (just check if valid)
 * @param token JWT token string
 * @param secret JWT secret key
 * @returns boolean indicating if token is valid
 */
export function verifyJWT(token: string, secret?: string): boolean {
  try {
    if (!secret) {
      return false
    }

    jsonwebtoken.verify(token, secret)
    return true
  } catch {
    return false
  }
}

/**
 * Decode JWT token without verification (for debugging)
 * @param token JWT token string
 * @returns Decoded JWT payload (unverified)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decodeJWT<T = any>(token: string): T | null {
  try {
    const decoded = jsonwebtoken.decode(token) as T
    return decoded
  } catch {
    return null
  }
}

/**
 * Check if JWT token is expired
 * @param token JWT token string
 * @returns boolean indicating if token is expired
 */
export function isJWTExpired(token: string): boolean {
  try {
    const decoded = decodeJWT<{ exp?: number }>(token)
    if (!decoded || !decoded.exp) {
      return true
    }

    const currentTime = Math.floor(Date.now() / 1000)
    return decoded.exp < currentTime
  } catch {
    return true
  }
}

/**
 * Detect if a token is a JWT format (has three parts separated by dots)
 * @param token Token string to check
 * @returns boolean indicating if token is JWT format
 */
export function isJWTFormat(token: string): boolean {
  try {
    const parts = token.split('.')
    return parts.length === 3 && parts.every((part) => part.length > 0)
  } catch {
    return false
  }
}
