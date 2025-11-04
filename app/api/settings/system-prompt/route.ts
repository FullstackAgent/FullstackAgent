import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { systemPrompt: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ systemPrompt: user.systemPrompt })
  } catch (error) {
    console.error('Error fetching system prompt:', error)
    return NextResponse.json({ error: 'Failed to fetch system prompt' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { systemPrompt } = await request.json()

    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return NextResponse.json(
        { error: 'System prompt is required and must be a string' },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: { systemPrompt },
      select: { systemPrompt: true },
    })

    return NextResponse.json({
      message: 'System prompt saved successfully',
      systemPrompt: user.systemPrompt,
    })
  } catch (error) {
    console.error('Error saving system prompt:', error)
    return NextResponse.json({ error: 'Failed to save system prompt' }, { status: 500 })
  }
}
