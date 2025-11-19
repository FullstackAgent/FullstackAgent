/**
 * GET /api/sandbox/[id]/cwd
 *
 * Get current working directory of a terminal session in the sandbox.
 * Uses session ID to identify the specific terminal instance.
 *
 * Query Parameters:
 * - sessionId: Terminal session ID (from TERMINAL_SESSION_ID env var in shell)
 *
 * Returns:
 * - cwd: Absolute path of current working directory
 * - homeDir: User's home directory path
 * - isInHome: Whether cwd is within homeDir
 *
 * Security:
 * - Only allows file uploads within user's home directory
 * - Uses /proc filesystem to find shell process by session ID
 */

import { NextResponse } from 'next/server'

import { verifySandboxAccess, withAuth } from '@/lib/api-auth'
import { getK8sServiceForUser } from '@/lib/k8s/k8s-service-helper'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'api/sandbox/[id]/cwd' })

interface CwdResponse {
  cwd: string
  homeDir: string
  isInHome: boolean
}

type GetCwdResponse = { error: string } | CwdResponse

export const GET = withAuth<GetCwdResponse>(async (req, context, session) => {
  const resolvedParams = await context.params
  const sandboxId = Array.isArray(resolvedParams.id) ? resolvedParams.id[0] : resolvedParams.id

  try {
    // Get sessionId from query params
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      logger.warn(`Missing sessionId query parameter for sandbox ${sandboxId}`)
      return NextResponse.json({ error: 'sessionId query parameter is required' }, { status: 400 })
    }

    // Verify user owns this sandbox
    const sandbox = await verifySandboxAccess(sandboxId, session.user.id)

    logger.info(
      `Getting current directory for sandbox ${sandboxId} (${sandbox.sandboxName}) with session ${sessionId}`
    )

    // Get K8s service for user
    const k8sService = await getK8sServiceForUser(session.user.id)

    // Get current working directory from sandbox
    const cwdInfo = await k8sService.getSandboxCurrentDirectory(
      sandbox.k8sNamespace,
      sandbox.sandboxName,
      sessionId
    )

    logger.info(
      `Current directory for sandbox ${sandboxId}: ${cwdInfo.cwd} (isInHome: ${cwdInfo.isInHome})`
    )

    return NextResponse.json({
      cwd: cwdInfo.cwd,
      homeDir: cwdInfo.homeDir,
      isInHome: cwdInfo.isInHome,
    })
  } catch (error) {
    logger.error(`Failed to get sandbox cwd: ${error}`)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to get current directory: ${errorMessage}` },
      { status: 500 }
    )
  }
})