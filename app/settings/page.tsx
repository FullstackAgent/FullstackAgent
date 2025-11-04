import { Database, Save, Settings, Shield, Terminal } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

import SettingsClient from './settings-client';

export default async function SettingsPage() {
  const session = await auth();

  if (!session || !session.user?.id) {
    redirect('/login');
  }

  // Find user by id
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    redirect('/login');
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
