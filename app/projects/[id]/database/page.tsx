import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import DatabaseConfiguration from "@/components/database-configuration";

export default async function DatabaseConfigurationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: id,
      userId: session.user.id,
    },
    include: {
      sandboxes: true,
      databases: true,
      environments: true,
    },
  });

  if (!project) {
    notFound();
  }

  // Get database from project (new architecture uses databases array)
  const database = project.databases[0];
  let dbUrlEnvVar = project.environments.find(env => env.key === "DATABASE_URL");
  let enrichedEnvVars = [...project.environments];

  if (!dbUrlEnvVar && database) {
    // Construct DATABASE_URL from database connection info
    let databaseUrl = null;

    if (database.connectionUrl) {
      databaseUrl = database.connectionUrl;
    } else if (database.host && database.username && database.password) {
      databaseUrl = `postgresql://${database.username}:${database.password}@${database.host}:${database.port || 5432}/${database.database || 'postgres'}?schema=public`;
    }

    // If we have a database URL, add it to environment variables for display
    if (databaseUrl) {
      enrichedEnvVars.push({
        id: 'temp-db-url',
        key: 'DATABASE_URL',
        value: databaseUrl,
        category: 'database',
        isSecret: true,
        projectId: project.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return (
    <DatabaseConfiguration
      project={project}
      environmentVariables={enrichedEnvVars}
    />
  );
}