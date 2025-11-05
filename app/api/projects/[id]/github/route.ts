import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Connect GitHub repository to project
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { repoName } = body

    if (!repoName) {
      return NextResponse.json({ error: 'Repository name is required' }, { status: 400 })
    }

    // Validate repository name format
    if (!repoName.includes('/') || repoName.split('/').length !== 2) {
      return NextResponse.json(
        { error: 'Invalid repository format. Use: username/repository' },
        { status: 400 }
      )
    }

    // Update project with GitHub repository
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { githubRepo: repoName },
    })

    return NextResponse.json({
      success: true,
      githubRepo: updated.githubRepo,
    })
  } catch (error) {
    console.error('Error connecting GitHub repository:', error)
    return NextResponse.json({ error: 'Failed to connect GitHub repository' }, { status: 500 })
  }
}

// Disconnect GitHub repository from project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Remove GitHub repository from project
    await prisma.project.update({
      where: { id: projectId },
      data: { githubRepo: null },
    })

    return NextResponse.json({
      success: true,
      message: 'GitHub repository disconnected',
    })
  } catch (error) {
    console.error('Error disconnecting GitHub repository:', error)
    return NextResponse.json({ error: 'Failed to disconnect GitHub repository' }, { status: 500 })
  }
}

// Get GitHub repository info
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      select: {
        githubRepo: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({
      githubRepo: project.githubRepo,
      connected: !!project.githubRepo,
    })
  } catch (error) {
    console.error('Error getting GitHub repository info:', error)
    return NextResponse.json({ error: 'Failed to get GitHub repository info' }, { status: 500 })
  }
}
