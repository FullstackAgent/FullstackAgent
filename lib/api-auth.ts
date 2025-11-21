/**
 * API Authentication Utilities
 *
 * Unified authentication helpers for Next.js 15 App Router API routes
 * Based on NextAuth v5 best practices
 *
 * Best Practice (from NextAuth docs):
 * "You should not rely on middleware exclusively for authorization.
 *  Always ensure that the session is verified as close to your data fetching as possible."
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'lib/api-auth' })

/**
 * Authenticated session interface
 * Extends NextAuth session with guaranteed user.id
 */
export interface AuthSession {
  user: {
    id: string
    name?: string | null
  }
}

/**
 * Route context type for Next.js 15 App Router
 * params is a Promise in Next.js 15+
 */
export interface RouteContext {
  params: Promise<Record<string, string | string[]>>
}

/**
 * Authenticated route handler type
 */
type AuthenticatedHandler<T = unknown> = (
  req: NextRequest,
  context: RouteContext,
  session: AuthSession
) => Promise<NextResponse<T>> | NextResponse<T>

/**
 * Higher-Order Function: Wrap API route handlers with authentication
 *
 * This is the RECOMMENDED approach for protecting API routes.
 * It automatically checks authentication and passes verified session to your handler.
 *
 * Example usage:
 * ```typescript
 * export const GET = withAuth(async (req, context, session) => {
 *   // session.user.id is guaranteed to exist
 *   const userId = session.user.id
 *
 *   const data = await getData(userId)
 *   return NextResponse.json(data)
 * })
 *
 * export const POST = withAuth(async (req, context, session) => {
 *   const body = await req.json()
 *   // ... your logic
 *   return NextResponse.json({ success: true })
 * })
 * ```
 *
 * @param handler - Your route handler function
 * @returns Wrapped handler that checks auth before execution
 */
export function withAuth<T = unknown>(handler: AuthenticatedHandler<T>) {
  return async (req: NextRequest, context: RouteContext): Promise<NextResponse<T>> => {
    const startTime = Date.now()

    try {
      // Check authentication using NextAuth v5
      const session = await auth()

      if (!session || !session.user?.id) {
        const duration = Date.now() - startTime
        logger.warn(
          `Unauthorized access attempt: ${req.method} ${req.nextUrl.pathname} (${duration}ms)`
        )
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        ) as NextResponse<T>
      }

      // Log successful authentication
      const duration = Date.now() - startTime
      logger.debug(
        `Auth OK: ${req.method} ${req.nextUrl.pathname} | User: ${session.user.id} (${duration}ms)`
      )

      // Call the original handler with verified session
      return await handler(req, context, session as AuthSession)
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error(
        `Auth error: ${req.method} ${req.nextUrl.pathname} (${duration}ms) - ${error}`
      )

      // Check if error is already a NextResponse (from handler)
      if (error instanceof NextResponse) {
        throw error
      }

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) as NextResponse<
        T
      >
    }
  }
}

/**
 * Manual auth check: Returns session or throws 401 response
 *
 * Use this when you need more control or can't use the withAuth wrapper.
 *
 * Example usage:
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   const session = await requireAuth(req)
 *   // session.user.id is guaranteed to exist
 *
 *   const data = await getData(session.user.id)
 *   return NextResponse.json(data)
 * }
 * ```
 *
 * @param req - Next.js request object (for logging)
 * @returns Verified session
 * @throws NextResponse with 401 if not authenticated
 */
export async function requireAuth(req: NextRequest): Promise<AuthSession> {
  const session = await auth()

  if (!session || !session.user?.id) {
    logger.warn(`Unauthorized: ${req.method} ${req.nextUrl.pathname}`)
    throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  logger.debug(`Authenticated: ${req.method} ${req.nextUrl.pathname} | User: ${session.user.id}`)

  return session as AuthSession
}

/**
 * Optional auth check: Returns session or null (no error)
 *
 * Use for endpoints that behave differently for authenticated vs anonymous users.
 *
 * Example usage:
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   const session = await optionalAuth()
 *
 *   if (session) {
 *     // Return personalized data
 *     return NextResponse.json({ data: getPrivateData(session.user.id) })
 *   } else {
 *     // Return public data
 *     return NextResponse.json({ data: getPublicData() })
 *   }
 * }
 * ```
 *
 * @returns Session or null
 */
export async function optionalAuth(): Promise<AuthSession | null> {
  const session = await auth()

  if (!session || !session.user?.id) {
    return null
  }

  return session as AuthSession
}

/**
 * Business logic helper: Verify user owns a project
 *
 * This combines authentication with ownership verification.
 * Commonly used pattern in this codebase.
 *
 * Example usage:
 * ```typescript
 * export const GET = withAuth(async (req, context, session) => {
 *   const { id } = await context.params
 *
 *   // Check if user owns this project
 *   const project = await verifyProjectAccess(id, session.user.id)
 *
 *   // project is guaranteed to exist and belong to the user
 *   return NextResponse.json(project)
 * })
 * ```
 *
 * @param projectId - Project ID to verify
 * @param userId - User ID from session
 * @returns Project if user has access
 * @throws NextResponse with 404 if project not found or access denied
 */
export async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: userId,
    },
  })

  if (!project) {
    logger.warn(`Project access denied: projectId=${projectId}, userId=${userId}`)
    throw NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  logger.debug(`Project access granted: projectId=${projectId}, userId=${userId}`)
  return project
}

/**
 * Business logic helper: Verify user owns a project (with relations)
 *
 * Same as verifyProjectAccess but includes common relations.
 *
 * @param projectId - Project ID to verify
 * @param userId - User ID from session
 * @returns Project with sandboxes and environment variables
 * @throws NextResponse with 404 if project not found or access denied
 */
export async function verifyProjectAccessWithRelations(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: userId,
    },
    include: {
      sandboxes: true,
      environments: true,
    },
  })

  if (!project) {
    logger.warn(`Project access denied: projectId=${projectId}, userId=${userId}`)
    throw NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  logger.debug(`Project access granted (with relations): projectId=${projectId}, userId=${userId}`)
  return project
}

/**
 * Business logic helper: Verify user owns a sandbox
 *
 * This verifies that the user has access to the sandbox (through project ownership).
 *
 * Example usage:
 * ```typescript
 * export const GET = withAuth(async (req, context, session) => {
 *   const { id } = await context.params
 *
 *   // Check if user owns this sandbox
 *   const sandbox = await verifySandboxAccess(id, session.user.id)
 *
 *   // sandbox is guaranteed to exist and belong to the user
 *   return NextResponse.json(sandbox)
 * })
 * ```
 *
 * @param sandboxId - Sandbox ID to verify
 * @param userId - User ID from session
 * @returns Sandbox if user has access
 * @throws NextResponse with 404 if sandbox not found or access denied
 */
export async function verifySandboxAccess(sandboxId: string, userId: string) {
  const sandbox = await prisma.sandbox.findFirst({
    where: {
      id: sandboxId,
    },
    include: {
      project: {
        select: {
          userId: true,
        },
      },
    },
  })

  if (!sandbox || sandbox.project.userId !== userId) {
    logger.warn(`Sandbox access denied: sandboxId=${sandboxId}, userId=${userId}`)
    throw NextResponse.json({ error: 'Sandbox not found' }, { status: 404 })
  }

  logger.debug(`Sandbox access granted: sandboxId=${sandboxId}, userId=${userId}`)
  return sandbox
}
