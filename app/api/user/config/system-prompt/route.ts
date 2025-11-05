/**
 * System Prompt Management API
 *
 * GET /api/user/config/system-prompt
 * - Get current system prompt
 * - Returns: { systemPrompt: string }
 *
 * POST /api/user/config/system-prompt
 * - Save system prompt
 * - Body: { systemPrompt: string }
 * - Returns: { success: true }
 */

import { NextRequest, NextResponse } from 'next/server'

import { type RouteContext, withAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'api/user/config/system-prompt' })

const SYSTEM_PROMPT_KEY = 'SYSTEM_PROMPT'

type GetSystemPromptResponse = { error: string } | { systemPrompt: string | null }

/**
 * GET /api/user/config/system-prompt
 * Get current system prompt
 */
export const GET = withAuth<GetSystemPromptResponse>(
  async (_req: NextRequest, _context: RouteContext, session) => {
  try {
    const config = await prisma.userConfig.findUnique({
      where: {
        userId_key: {
          userId: session.user.id,
          key: SYSTEM_PROMPT_KEY,
        },
      },
    })

    return NextResponse.json({
      systemPrompt: config?.value || null,
    })
  } catch (error) {
    logger.error(`Failed to fetch system prompt: ${error}`)
    return NextResponse.json({ error: 'Failed to fetch system prompt' }, { status: 500 })
  }
  }
)

/**
 * POST /api/user/config/system-prompt
 * Save system prompt
 */
interface SaveSystemPromptRequest {
  systemPrompt: string
}

type PostSystemPromptResponse = { error: string } | { success: true; message: string }

export const POST = withAuth<PostSystemPromptResponse>(
  async (req: NextRequest, _context: RouteContext, session) => {
  try {
    const body: SaveSystemPromptRequest = await req.json()

    if (!body.systemPrompt || typeof body.systemPrompt !== 'string') {
      return NextResponse.json({ error: 'System prompt is required' }, { status: 400 })
    }

    await prisma.userConfig.upsert({
      where: {
        userId_key: {
          userId: session.user.id,
          key: SYSTEM_PROMPT_KEY,
        },
      },
      create: {
        userId: session.user.id,
        key: SYSTEM_PROMPT_KEY,
        value: body.systemPrompt,
        category: 'anthropic',
        isSecret: false,
      },
      update: {
        value: body.systemPrompt,
      },
    })

    logger.info(`System prompt saved for user ${session.user.id}`)

    return NextResponse.json({
      success: true,
      message: 'System prompt saved successfully',
    })
  } catch (error) {
    logger.error(`Failed to save system prompt: ${error}`)
    return NextResponse.json({ error: 'Failed to save system prompt' }, { status: 500 })
  }
  }
)
