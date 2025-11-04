import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getK8sServiceForUser } from '@/lib/k8s/k8s-service-helper'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        environments: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Group environment variables by category
    const grouped = {
      general: project.environments.filter((e) => !e.category || e.category === 'general'),
      auth: project.environments.filter((e) => e.category === 'auth'),
      payment: project.environments.filter((e) => e.category === 'payment'),
    }

    return NextResponse.json(grouped)
  } catch (error) {
    console.error('Error fetching environment variables:', error)
    return NextResponse.json({ error: 'Failed to fetch environment variables' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()

    // Check if this is a single variable creation or batch update
    if (body.key && body.value) {
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

      // Update Kubernetes StatefulSet if requested
      if (body.updateDeployment) {
        try {
          // Get sandbox info
          const sandbox = await prisma.sandbox.findFirst({
            where: { projectId: id },
          })

          if (sandbox && sandbox.sandboxName) {
            // Get K8s service for user
            const k8sService = await getK8sServiceForUser(session.user.id)

            // Get all environment variables for the project
            const allEnvVars = await prisma.environment.findMany({
              where: { projectId: id },
            })

            // Convert to key-value pairs
            const envVarsMap: Record<string, string> = {}
            allEnvVars.forEach((env) => {
              envVarsMap[env.key] = env.value
            })

            // Update the StatefulSet with new environment variables
            await k8sService.updateStatefulSetEnvVars(
              project.name,
              sandbox.k8sNamespace || k8sService.getDefaultNamespace(),
              envVarsMap
            )

            console.log(
              `✅ Updated Kubernetes StatefulSet with new environment variable: ${body.key}`
            )
          }
        } catch (k8sError) {
          console.error('Failed to update Kubernetes StatefulSet:', k8sError)
          // Don't fail the request if Kubernetes update fails
          // The environment variable is already saved in the database
        }
      }

      return NextResponse.json(newVar)
    } else if (body.variables) {
      // Batch update (existing functionality)
      const { variables } = body

      // Delete existing environment variables
      await prisma.environment.deleteMany({
        where: {
          projectId: id,
        },
      })

      // Create new environment variables
      const envPromises = variables
        .filter((v: any) => v.key && v.value)
        .map((v: any) =>
          prisma.environment.create({
            data: {
              projectId: id,
              key: v.key,
              value: v.value,
              category: 'general',
              isSecret: false,
            },
          })
        )

      await Promise.all(envPromises)

      // TODO: Update Kubernetes ConfigMap with new environment variables

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error saving environment variables:', error)
    return NextResponse.json({ error: 'Failed to save environment variables' }, { status: 500 })
  }
}
