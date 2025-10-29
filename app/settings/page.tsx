import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Settings, Terminal, Database, Shield } from "lucide-react";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();

  if (!session || !session.user?.id) {
    redirect("/login");
  }

  // Find user by id
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    redirect("/login");
  }

  // Get user's projects for system prompt context
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      description: true,
      environments: {
        select: {
          key: true,
          value: true,
          category: true,
        },
      },
    },
  });

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>
        <p className="text-sm text-gray-400">
          Configure your development environment and system preferences
        </p>
      </div>

      <SettingsClient user={user} projects={projects} />
    </div>
  );
}