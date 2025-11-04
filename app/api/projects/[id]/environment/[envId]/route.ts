import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getK8sServiceForUser } from "@/lib/k8s/k8s-service-helper";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, envId } = await params;

  try {
    // Verify the project belongs to the user
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify the environment variable belongs to the project
    const envVar = await prisma.environment.findFirst({
      where: {
        id: envId,
        projectId: projectId,
      },
    });

    if (!envVar) {
      return NextResponse.json({ error: "Environment variable not found" }, { status: 404 });
    }

    const body = await request.json();
    const { value } = body;

    // Update the environment variable
    const updated = await prisma.environment.update({
      where: { id: envId },
      data: { value },
    });

    // Update Kubernetes deployment with new value
    try {
      const sandbox = await prisma.sandbox.findFirst({
        where: { projectId }
      });

      if (sandbox && sandbox.sandboxName) {
        // Get K8s service for user
        const k8sService = await getK8sServiceForUser(session.user.id);

        // Get all environment variables for the project
        const allEnvVars = await prisma.environment.findMany({
          where: { projectId }
        });

        // Convert to key-value pairs
        const envVarsMap: Record<string, string> = {};
        allEnvVars.forEach(env => {
          envVarsMap[env.key] = env.value;
        });

        // Update the deployment with new environment variables
        await k8sService.updateStatefulSetEnvVars(
          project.name,
          sandbox.k8sNamespace || k8sService.getDefaultNamespace(),
          envVarsMap
        );

        console.log(`✅ Updated Kubernetes deployment after editing environment variable: ${envVar.key}`);
      }
    } catch (k8sError) {
      console.error("Failed to update Kubernetes deployment:", k8sError);
      // Don't fail the request if Kubernetes update fails
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating environment variable:", error);
    return NextResponse.json({ error: "Failed to update environment variable" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, envId } = await params;

  try {
    // Verify the project belongs to the user
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify the environment variable belongs to the project
    const envVar = await prisma.environment.findFirst({
      where: {
        id: envId,
        projectId: projectId,
      },
    });

    if (!envVar) {
      return NextResponse.json({ error: "Environment variable not found" }, { status: 404 });
    }

    // Delete the environment variable
    await prisma.environment.delete({
      where: { id: envId },
    });

    // Update Kubernetes deployment to remove the variable
    try {
      const sandbox = await prisma.sandbox.findFirst({
        where: { projectId }
      });

      if (sandbox && sandbox.sandboxName) {
        // Get K8s service for user
        const k8sService = await getK8sServiceForUser(session.user.id);

        // Get remaining environment variables for the project
        const remainingEnvVars = await prisma.environment.findMany({
          where: { projectId }
        });

        // Convert to key-value pairs
        const envVarsMap: Record<string, string> = {};
        remainingEnvVars.forEach(env => {
          envVarsMap[env.key] = env.value;
        });

        // Update the deployment with remaining environment variables
        await k8sService.updateStatefulSetEnvVars(
          project.name,
          sandbox.k8sNamespace || k8sService.getDefaultNamespace(),
          envVarsMap
        );

        console.log(`✅ Updated Kubernetes deployment after deleting environment variable: ${envVar.key}`);
      }
    } catch (k8sError) {
      console.error("Failed to update Kubernetes deployment:", k8sError);
      // Don't fail the request if Kubernetes update fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting environment variable:", error);
    return NextResponse.json({ error: "Failed to delete environment variable" }, { status: 500 });
  }
}