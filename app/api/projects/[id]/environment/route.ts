import type { Environment } from '@prisma/client'
import { NextResponse } from 'next/server'

import { verifyProjectAccess, withAuth } from '@/lib/api-auth'
import { EnvironmentCategory } from '@/lib/const'
import { prisma } from '@/lib/db'

type GroupedEnvironments = Record<string, Environment[]>

type GetEnvironmentsResponse = { error: string } | GroupedEnvironments

export const GET = withAuth<GetEnvironmentsResponse>(async (_req, context, session) => {
  const resolvedParams = await context.params
  const projectId = Array.isArray(resolvedParams.id) ? resolvedParams.id[0] : resolvedParams.id

  try {
    await verifyProjectAccess(projectId, session.user.id)

    // Fetch environment variables
    const environments = await prisma.environment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })

    // Group environment variables by category (dynamically based on EnvironmentCategory enum)
    const grouped: GroupedEnvironments = {}

    // Initialize all categories from enum
    Object.values(EnvironmentCategory).forEach((category) => {
      grouped[category] = environments.filter((e) => e.category === category)
    })

    // Add general category for 'general' and null/undefined categories
    grouped.general = environments.filter((e) => e.category === 'general' || !e.category)

    return NextResponse.json(grouped)
  } catch (error) {
    console.error('Error fetching environment variables:', error)
    return NextResponse.json({ error: 'Failed to fetch environment variables' }, { status: 500 })
  }
})

interface EnvironmentVariableInput {
  key: string
  value: string
  category?: string
  isSecret?: boolean
}

type PostEnvironmentResponse =
  | { error: string }
  | Environment
  | { success: true; count: number }

export const POST = withAuth<PostEnvironmentResponse>(async (req, context, session) => {
  const resolvedParams = await context.params
  const projectId = Array.isArray(resolvedParams.id) ? resolvedParams.id[0] : resolvedParams.id

  try {
    await verifyProjectAccess(projectId, session.user.id)
    const body = await req.json()

    // Check if this is a single variable creation or batch update
    if (body.key && body.value !== undefined) {
      // Single variable creation
      const newVar = await prisma.environment.create({
        data: {
          projectId,
          key: body.key,
          value: body.value,
          category: body.category || 'general',
          isSecret: body.isSecret || false,
        },
      })

      return NextResponse.json(newVar)
    } else if (body.variables) {
      // Batch update (replace variables by category)
      const { variables } = body

      // Determine the primary category for this batch update
      // If all variables have the same category, only delete that category
      // Otherwise, delete all to maintain backward compatibility
      const categories = new Set((variables as EnvironmentVariableInput[]).map(v => v.category || 'general'))
      const deleteByCategory = categories.size === 1

      if (deleteByCategory) {
        // Delete only environment variables of the same category
        const targetCategory = Array.from(categories)[0]
        await prisma.environment.deleteMany({
          where: {
            projectId,
            category: targetCategory
          },
        })
      } else {
        // Mixed categories - delete all (fallback behavior)
        await prisma.environment.deleteMany({
          where: { projectId },
        })
      }

      // Create new environment variables
      const envPromises = (variables as EnvironmentVariableInput[])
        .filter((v) => v.key && v.value !== undefined)
        .map((v) =>
          prisma.environment.create({
            data: {
              projectId,
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
