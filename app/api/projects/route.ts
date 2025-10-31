import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { k8sService } from '@/lib/kubernetes'

export async function GET() {
  const session = await auth()

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, description } = body

    // Create project in database
    const project = await prisma.project.create({
      data: {
        name,
        description,
        userId: session.user.id,
        status: 'INITIALIZING',
      },
    })

    console.log(`🚀 Creating Kubernetes resources for project: ${project.name} (ID: ${project.id})`)

    try {
      // Create database first
      const databaseInfo = await k8sService.createPostgreSQLDatabase(project.name)
      console.log(`✅ Database created: ${databaseInfo.clusterName}`)

      // Create Kubernetes sandbox resources
      const sandboxInfo = await k8sService.createSandbox(
        project.name,
        {}, // envVars
        k8sService.getDefaultNamespace(),
        databaseInfo
      )
      console.log(`✅ Sandbox created: ${sandboxInfo.statefulSetName}`)

      // Create sandbox record in database
      const sandbox = await prisma.sandbox.create({
        data: {
          projectId: project.id,
          k8sNamespace: k8sService.getDefaultNamespace(),
          k8sDeploymentName: sandboxInfo.statefulSetName,
          k8sServiceName: sandboxInfo.serviceName,
          publicUrl: sandboxInfo.publicUrl,
          ttydUrl: sandboxInfo.ttydUrl,
          status: 'CREATING',
        },
      })

      // Update project status
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'READY' },
      })

      console.log(`✅ Project ${project.name} created successfully with sandbox resources`)
    } catch (k8sError) {
      console.error(
        `❌ Failed to create Kubernetes resources for project ${project.name}:`,
        k8sError
      )

      // Clean up the project if Kubernetes creation failed
      await prisma.project.delete({ where: { id: project.id } })

      throw new Error(
        `Failed to create sandbox environment: ${k8sError instanceof Error ? k8sError.message : String(k8sError)}`
      )
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
