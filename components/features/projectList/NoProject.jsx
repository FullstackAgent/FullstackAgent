import { Folder, Plus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';


export default function NoProject() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Folder className="h-12 w-12 text-gray-600 mb-4" />
      <h2 className="text-sm font-medium text-gray-300 mb-1">No projects yet</h2>
      <p className="text-xs text-gray-500 mb-4">
        Create your first project to get started
      </p>
      <Link href="/projects/new">
        <Button
          size="sm"
          className="h-7 bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs px-3"
        >
          <Plus className="mr-1 h-3 w-3" />
          Create Project
        </Button>
      </Link>
    </div>
  )
}