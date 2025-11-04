import { NextRequest, NextResponse } from 'next/server'

import { verifyProjectAccess, withAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const GET = withAuth(async (req, context, session) => {
  const { id } = await context.params

  try {
    const project = await verifyProjectAccess(id, session.user.id)

    // Fetch environment variables
    const environments = await prisma.environment.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
    })

    // Group environment variables by category
    const grouped = {
      general: environments.filter((e) => !e.category || e.category === 'general'),
      auth: environments.filter((e) => e.category === 'auth'),
      payment: environments.filter((e) => e.category === 'payment'),
    }

    return NextResponse.json(grouped)
  } catch (error) {
    console.error('Error fetching environment variables:', error)
    return NextResponse.json({ error: 'Failed to fetch environment variables' }, { status: 500 })
  }
})

export const POST = withAuth(async (req, context, session) => {
  const { id } = await context.params

  try {
    const project = await verifyProjectAccess(id, session.user.id)
    const body = await req.json()

    // Check if this is a single variable creation or batch update
    if (body.key && body.value !== undefined) {
      // Single variable creation
      const newVar = await prisma.environment.create({
        data: {
          projectId: id,
          key: body.key,
          value: body.value,
          category: body.category || 'general',
          isSecret: body.isSecret || false,
        },
      })

      return NextResponse.json(newVar)
    } else if (body.variables) {
      // Batch update (replace all variables)
      const { variables } = body

      // Delete existing environment variables
      await prisma.environment.deleteMany({
        where: { projectId: id },
      })

      // Create new environment variables
      const envPromises = variables
        .filter((v: any) => v.key && v.value !== undefined)
        .map((v: any) =>
          prisma.environment.create({
            data: {
              projectId: id,
              key: v.key,
              value: v.value,
              category: v.category || 'general',
              isSecret: v.isSecret || false,
            },
          })
        )

      const created = await Promise.all(envPromises)

      return NextResponse.json({ success: true, count: created.length })
    } else {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error saving environment variables:', error)
    return NextResponse.json({ error: 'Failed to save environment variables' }, { status: 500 })
  }
})
