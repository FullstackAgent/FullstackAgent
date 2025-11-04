import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getK8sServiceForUser } from '@/lib/k8s/k8s-service-helper'

// Sync database info from Kubernetes to database
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    // Get project with database
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      include: {
        databases: true,
        sandboxes: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const database = project.databases[0]
    if (!database) {
      return NextResponse.json({ error: 'No database found' }, { status: 404 })
    }

    // Check if database info is already saved
    if (database.host && database.password) {
      return NextResponse.json({
        message: 'Database info already synced',
        database: {
          host: database.host,
          port: database.port,
          name: database.database,
          user: database.username,
          password: database.password,
        },
      })
    }

    // Fetch database info from Kubernetes
    try {
      // Get K8s service for user
      const k8sService = await getK8sServiceForUser(session.user.id)
      const k8sNamespace = database.k8sNamespace || k8sService.getDefaultNamespace()
      const dbInfo = await k8sService.getDatabaseCredentials(database.databaseName, k8sNamespace)

      // Update database record with connection info
      const updatedDatabase = await prisma.database.update({
        where: { id: database.id },
        data: {
          host: dbInfo.host,
          port: dbInfo.port,
          database: dbInfo.database,
          username: dbInfo.username,
          password: dbInfo.password,
          connectionUrl: `postgresql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?schema=public`,
          status: 'RUNNING',
        },
      })

      return NextResponse.json({
        message: 'Database info synced successfully',
        database: {
          host: updatedDatabase.host,
          port: updatedDatabase.port,
          name: updatedDatabase.database,
          user: updatedDatabase.username,
          password: updatedDatabase.password,
        },
      })
    } catch (k8sError) {
      console.error('Failed to get database info from Kubernetes:', k8sError)

      // Try to parse from environment variables or use defaults
      const defaultDb = {
        host: `${database.databaseName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '')
          .substring(0, 20)}-postgresql`,
        port: 5432,
        database: 'postgres',
        username: 'postgres',
        password: null,
      }

      return NextResponse.json(
        {
          error: 'Could not fetch database credentials from Kubernetes',
          defaultDatabase: defaultDb,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error syncing database info:', error)
    return NextResponse.json({ error: 'Failed to sync database info' }, { status: 500 })
  }
}

// Get current database info
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
      include: {
        databases: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const database = project.databases[0]
    if (!database) {
      return NextResponse.json({ error: 'No database found' }, { status: 404 })
    }

    // If database info exists in database record, return it
    if (database.host && database.password) {
      const connectionString =
        database.connectionUrl ||
        `postgresql://${database.username}:${database.password}@${database.host}:${database.port}/${database.database}?schema=public`

      return NextResponse.json({
        database: {
          host: database.host,
          port: database.port,
          name: database.database,
          user: database.username,
          password: database.password,
          connectionString,
        },
      })
    }

    // Otherwise try to fetch from Kubernetes
    try {
      // Get K8s service for user
      const k8sService = await getK8sServiceForUser(session.user.id)
      const k8sNamespace = database.k8sNamespace || k8sService.getDefaultNamespace()
      const dbInfo = await k8sService.getDatabaseCredentials(database.databaseName, k8sNamespace)

      const connectionString = `postgresql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?schema=public`

      // Save it for future use
      await prisma.database.update({
        where: { id: database.id },
        data: {
          host: dbInfo.host,
          port: dbInfo.port,
          database: dbInfo.database,
          username: dbInfo.username,
          password: dbInfo.password,
          connectionUrl: connectionString,
          status: 'RUNNING',
        },
      })

      return NextResponse.json({
        database: {
          host: dbInfo.host,
          port: dbInfo.port,
          name: dbInfo.database,
          user: dbInfo.username,
          password: dbInfo.password,
          connectionString,
        },
      })
    } catch (k8sError) {
      return NextResponse.json(
        {
          error: 'No database configured',
          message: 'Could not fetch database info from Kubernetes',
        },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Error getting database info:', error)
    return NextResponse.json({ error: 'Failed to get database info' }, { status: 500 })
  }
}
