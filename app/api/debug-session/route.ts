import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()

    let dbUser = null
    if (session?.user?.email) {
      dbUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: session.user.email }, { name: session.user.name || undefined }].filter(
            Boolean
          ),
        },
        include: {
          projects: true,
        },
      })
    }

    return NextResponse.json({
      session: session,
      sessionUserId: session?.user?.id,
      sessionUserEmail: session?.user?.email,
      sessionUserName: session?.user?.name,
      dbUser: dbUser
        ? {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            githubId: dbUser.githubId,
            projectCount: dbUser.projects.length,
            projects: dbUser.projects.map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
            })),
          }
        : null,
      authenticated: !!session,
      note: 'Visit /api/debug-session to see current auth status',
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
