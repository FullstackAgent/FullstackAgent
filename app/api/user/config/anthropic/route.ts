/**
 * Anthropic Configuration API
 *
 * GET /api/user/config/anthropic
 * - Get Anthropic API configuration
 * - Returns: { apiBaseUrl: string | null, apiKey: string | null }
 *
 * POST /api/user/config/anthropic
 * - Save Anthropic API configuration
 * - Body: { apiBaseUrl: string, apiKey: string }
 * - Returns: { success: true }
 */

import { NextRequest, NextResponse } from 'next/server'

import { type RouteContext, withAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'api/user/config/anthropic' })

const ANTHROPIC_API_KEY = 'ANTHROPIC_API_KEY'
const ANTHROPIC_API = 'ANTHROPIC_API'

type GetAnthropicConfigResponse =
  | { error: string }
  | { apiKey: string | null; apiBaseUrl: string | null }

/**
 * GET /api/user/config/anthropic
 * Get Anthropic API configuration
 */
export const GET = withAuth<GetAnthropicConfigResponse>(
  async (_req: NextRequest, _context: RouteContext, session) => {
  try {
    const configs = await prisma.userConfig.findMany({
      where: {
        userId: session.user.id,
        key: {
          in: [ANTHROPIC_API_KEY, ANTHROPIC_API],
        },
      },
    })

    const apiKey = configs.find((c) => c.key === ANTHROPIC_API_KEY)?.value || null
    const apiBaseUrl = configs.find((c) => c.key === ANTHROPIC_API)?.value || null

    return NextResponse.json({
      apiKey,
      apiBaseUrl,
    })
  } catch (error) {
    logger.error(`Failed to fetch Anthropic config: ${error}`)
    return NextResponse.json({ error: 'Failed to fetch Anthropic configuration' }, { status: 500 })
  }
  }
)

/**
 * POST /api/user/config/anthropic
 * Save Anthropic API configuration
 */
interface SaveAnthropicConfigRequest {
  apiBaseUrl: string
  apiKey: string
}

type PostAnthropicConfigResponse = { error: string } | { success: true; message: string }

export const POST = withAuth<PostAnthropicConfigResponse>(
  async (req: NextRequest, _context: RouteContext, session) => {
  try {
    const body: SaveAnthropicConfigRequest = await req.json()

    // Validate inputs
    if (!body.apiBaseUrl || typeof body.apiBaseUrl !== 'string') {
      return NextResponse.json({ error: 'API base URL is required' }, { status: 400 })
    }

    if (!body.apiKey || typeof body.apiKey !== 'string') {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(body.apiBaseUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid API base URL format' }, { status: 400 })
    }

    // Save both configs
    await Promise.all([
      // Save API key
      prisma.userConfig.upsert({
        where: {
          userId_key: {
            userId: session.user.id,
            key: ANTHROPIC_API_KEY,
          },
        },
        create: {
          userId: session.user.id,
          key: ANTHROPIC_API_KEY,
          value: body.apiKey,
          category: 'anthropic',
          isSecret: true,
        },
        update: {
          value: body.apiKey,
        },
      }),
      // Save API base URL
      prisma.userConfig.upsert({
        where: {
          userId_key: {
            userId: session.user.id,
            key: ANTHROPIC_API,
          },
        },
        create: {
          userId: session.user.id,
          key: ANTHROPIC_API,
          value: body.apiBaseUrl,
          category: 'anthropic',
          isSecret: false,
        },
        update: {
          value: body.apiBaseUrl,
        },
      }),
    ])

    logger.info(`Anthropic configuration saved for user ${session.user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Anthropic configuration saved successfully',
    })
  } catch (error) {
    logger.error(`Failed to save Anthropic config: ${error}`)
    return NextResponse.json({ error: 'Failed to save Anthropic configuration' }, { status: 500 })
  }
  }
)
