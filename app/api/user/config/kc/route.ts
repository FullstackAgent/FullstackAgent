/**
 * Kubeconfig Management API
 *
 * GET /api/user/config/kc
 * - Get current kubeconfig
 * - Returns: { kubeconfig: string, namespace?: string }
 *
 * POST /api/user/config/kc
 * - Validate and save kubeconfig
 * - Body: { kubeconfig: string }
 * - Validates before saving, returns error if invalid
 * - Returns: { success: true, namespace: string }
 */

import { NextRequest, NextResponse } from 'next/server'

import { type RouteContext, withAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { updateUserKubeconfig } from '@/lib/k8s/k8s-service-helper'
import { KubernetesUtils } from '@/lib/k8s/kubernetes-utils'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'api/user/config/kc' })

type GetKubeconfigResponse = { error: string } | { kubeconfig: string; namespace: string | null }

/**
 * GET /api/user/config/kc
 * Get current kubeconfig
 */
export const GET = withAuth<GetKubeconfigResponse>(
  async (_req: NextRequest, _context: RouteContext, session) => {
    try {
      const config = await prisma.userConfig.findUnique({
        where: {
          userId_key: {
            userId: session.user.id,
            key: 'KUBECONFIG',
          },
        },
      })

      if (!config) {
        return NextResponse.json({ error: 'Kubeconfig not found' }, { status: 404 })
      }

      // Extract namespace (optional)
      const namespace = KubernetesUtils.extractNamespaceFromString(config.value)

      return NextResponse.json({
        kubeconfig: config.value,
        namespace,
      })
    } catch (error) {
      logger.error(`Failed to fetch kubeconfig: ${error}`)
      return NextResponse.json({ error: 'Failed to fetch kubeconfig' }, { status: 500 })
    }
  }
)

/**
 * POST /api/user/config/kc
 * Validate and save kubeconfig
 */
interface SaveKubeconfigRequest {
  kubeconfig: string
}

type PostKubeconfigResponse =
  | { error: string; valid?: false }
  | { success: true; namespace: string | null; message: string }

export const POST = withAuth<PostKubeconfigResponse>(
  async (req: NextRequest, _context: RouteContext, session) => {
    try {
      const body: SaveKubeconfigRequest = await req.json()

      if (!body.kubeconfig || typeof body.kubeconfig !== 'string') {
        return NextResponse.json({ error: 'Kubeconfig is required' }, { status: 400 })
      }

      logger.info(`Validating kubeconfig for user ${session.user.id}`)

      // Step 1: Validate kubeconfig
      const validation = await KubernetesUtils.validateKubeconfig(body.kubeconfig)

      if (!validation.valid) {
        logger.warn(`Kubeconfig validation failed for user ${session.user.id}: ${validation.error}`)
        return NextResponse.json(
          {
            error: validation.error || 'Invalid kubeconfig',
            valid: false,
          },
          { status: 400 }
        )
      }

      logger.info(
        `Kubeconfig validation successful for user ${session.user.id}, namespace: ${validation.namespace}`
      )

      // Step 2: Save validated kubeconfig and clear factory cache
      await updateUserKubeconfig(session.user.id, body.kubeconfig)

      logger.info(`Kubeconfig saved successfully for user ${session.user.id}`)

      return NextResponse.json({
        success: true,
        namespace: validation.namespace ?? null,
        message: 'Kubeconfig validated and saved successfully',
      })
    } catch (error) {
      logger.error(`Failed to save kubeconfig: ${error}`)
      return NextResponse.json({ error: 'Failed to save kubeconfig' }, { status: 500 })
    }
  }
)
