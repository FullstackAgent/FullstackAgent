/**
 * User Configuration API
 *
 * GET /api/user/config?keys=KEY1,KEY2
 * - Fetch specific user config values
 * - Query params: keys (comma-separated list of config keys)
 * - Returns: { configs: { key: value, ... } }
 *
 * POST /api/user/config
 * - Update or create user config values
 * - Body: { configs: [{ key, value, category?, isSecret? }, ...] }
 * - Returns: { success: true, configs: [...] }
 */

import { NextRequest, NextResponse } from 'next/server'

import { type RouteContext, withAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'api/user/config' })

type GetConfigResponse = { error: string } | { configs: Record<string, string> }

/**
 * GET /api/user/config?keys=KEY1,KEY2
 * Fetch user config values
 */
export const GET = withAuth<GetConfigResponse>(
  async (req: NextRequest, _context: RouteContext, session) => {
  const { searchParams } = new URL(req.url)
  const keysParam = searchParams.get('keys')

  if (!keysParam) {
    return NextResponse.json({ error: 'Missing keys parameter' }, { status: 400 })
  }

  const keys = keysParam.split(',').map((k) => k.trim())

  try {
    const configs = await prisma.userConfig.findMany({
      where: {
        userId: session.user.id,
        key: { in: keys },
      },
      select: {
        key: true,
        value: true,
        category: true,
        isSecret: true,
      },
    })

    // Build response object
    const configMap: Record<string, string> = {}
    configs.forEach((config) => {
      configMap[config.key] = config.value
    })

    logger.debug(`Fetched ${configs.length} configs for user ${session.user.id}`)

    return NextResponse.json({ configs: configMap })
  } catch (error) {
    logger.error(`Failed to fetch user configs: ${error}`)
    return NextResponse.json({ error: 'Failed to fetch configurations' }, { status: 500 })
  }
  }
)

/**
 * POST /api/user/config
 * Update or create user config values
 */
interface UpdateConfigRequest {
  configs: Array<{
    key: string
    value: string
    category?: string
    isSecret?: boolean
  }>
}

type PostConfigResponse =
  | { error: string }
  | {
      success: true
      configs: Array<{
        key: string
        value: string
        category: string | null
        isSecret: boolean
      }>
    }

export const POST = withAuth<PostConfigResponse>(
  async (req: NextRequest, _context: RouteContext, session) => {
  try {
    const body: UpdateConfigRequest = await req.json()

    if (!body.configs || !Array.isArray(body.configs)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Validate config items
    for (const config of body.configs) {
      if (!config.key || typeof config.key !== 'string') {
        return NextResponse.json({ error: 'Each config must have a key' }, { status: 400 })
      }
      if (config.value === undefined || config.value === null) {
        return NextResponse.json({ error: 'Each config must have a value' }, { status: 400 })
      }
    }

    // Upsert all configs
    const results = await Promise.all(
      body.configs.map((config) =>
        prisma.userConfig.upsert({
          where: {
            userId_key: {
              userId: session.user.id,
              key: config.key,
            },
          },
          create: {
            userId: session.user.id,
            key: config.key,
            value: config.value,
            category: config.category,
            isSecret: config.isSecret ?? false,
          },
          update: {
            value: config.value,
            category: config.category,
            isSecret: config.isSecret,
          },
        })
      )
    )

    logger.info(`Updated ${results.length} configs for user ${session.user.id}`)

    return NextResponse.json({
      success: true,
      configs: results.map((r) => ({
        key: r.key,
        value: r.value,
        category: r.category,
        isSecret: r.isSecret,
      })),
    })
  } catch (error) {
    logger.error(`Failed to update user configs: ${error}`)
    return NextResponse.json({ error: 'Failed to update configurations' }, { status: 500 })
  }
  }
)
