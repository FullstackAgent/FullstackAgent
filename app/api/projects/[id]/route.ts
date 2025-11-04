import { NextResponse } from 'next/server';

import { verifyProjectAccess, withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/projects/[id]
 * Get project details with sandboxes and databases
 */
export const GET = withAuth(async (req, context, session) => {
  const { id } = await context.params;

  try {
    // Verify project access and get full project data
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        sandboxes: {
          orderBy: { createdAt: 'asc' },
        },
        databases: {
          orderBy: { createdAt: 'asc' },
        },
        environments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project details' },
      { status: 500 }
    );
  }
});