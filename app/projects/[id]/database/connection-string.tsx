'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';

interface ConnectionStringProps {
  connectionString: string;
}

export function ConnectionString({ connectionString }: ConnectionStringProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="pt-3 border-t border-[#3e3e42]">
      <label className="text-xs text-[#858585] mb-1 block">Full Connection String</label>
      <div className="relative">
        <Input
          type="text"
          readOnly
          value={isVisible ? connectionString : '•'.repeat(Math.min(connectionString.length, 50))}
          className="bg-[#3c3c3c] border-[#3e3e42] text-[#cccccc] font-mono text-sm pr-8 break-all focus-visible:border-[#3794ff] focus-visible:ring-1 focus-visible:ring-[#3794ff]"
        />
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#858585] hover:text-[#cccccc] transition-colors"
          type="button"
          aria-label={isVisible ? 'Hide connection string' : 'Show connection string'}
        >
          {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="text-xs text-[#858585] mt-1.5">
        Use this connection string in your application to connect to the database
      </p>
    </div>
  );
}
