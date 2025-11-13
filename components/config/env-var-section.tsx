/**
 * Environment Variable Section Component
 * Reusable section for managing categorized environment variables
 * VSCode Dark Modern style
 */

'use client';

import { useState } from 'react';
import { Copy, Eye, EyeOff, Hash, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface EnvironmentVariable {
  id?: string;
  key: string;
  value: string;
  isSecret?: boolean;
}

interface VariableTemplate {
  key: string;
  label: string;
  placeholder?: string;
  isSecret?: boolean;
  description?: string;
  readOnly?: boolean;
  generateValue?: () => string;
}

interface EnvVarSectionProps {
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Initial variables */
  variables: EnvironmentVariable[];
  /** Variable templates for this section */
  templates?: VariableTemplate[];
  /** Project sandboxes for status check */
  sandboxes: Array<{ status: string }>;
  /** Save handler */
  onSave: (variables: EnvironmentVariable[]) => Promise<void>;
  /** Whether data is being saved */
  saving?: boolean;
  /** Whether to allow free-form variable addition */
  allowCustomVariables?: boolean;
}

/**
 * Environment variable section with status checks and confirmation
 */
export function EnvVarSection({
  title,
  description,
  variables: initialVariables,
  templates = [],
  sandboxes,
  onSave,
  saving,
  allowCustomVariables = false,
}: EnvVarSectionProps) {
  const [variables, setVariables] = useState<EnvironmentVariable[]>(() => {
    // Initialize from templates if provided
    if (templates.length > 0) {
      return templates.map((template) => {
        const existing = initialVariables.find((v) => v.key === template.key);
        return {
          key: template.key,
          value: existing?.value || '',
          isSecret: template.isSecret || false,
        };
      });
    }
    return initialVariables;
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});

  // Check if ALL sandboxes are RUNNING (project must be RUNNING)
  const canUpdate =
    sandboxes.length > 0 && sandboxes.every((sb) => sb.status === 'RUNNING');

  const hasChanges = JSON.stringify(variables) !== JSON.stringify(initialVariables);

  const handleAdd = () => {
    setVariables([...variables, { key: '', value: '', isSecret: false }]);
  };

  const handleRemove = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const handleUpdate = (
    index: number,
    field: keyof EnvironmentVariable,
    value: string | boolean
  ) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };
    setVariables(updated);
  };

  const handleGenerate = (index: number, generateFn: () => string) => {
    handleUpdate(index, 'value', generateFn());
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success(`Copied ${key} to clipboard`);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSaveClick = () => {
    if (!canUpdate) {
      toast.error('Environment variables can only be updated when the project is running');
      return;
    }

    if (!hasChanges) {
      toast.info('No changes to save');
      return;
    }

    const invalidVars = variables.filter((v) => v.key && !v.value);
    if (invalidVars.length > 0) {
      toast.error('All variables must have a value');
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirm(false);
    try {
      // Filter out empty variables
      const validVars = variables.filter((v) => v.key && v.value);
      await onSave(validVars);
      toast.success('Environment variables updated successfully');
    } catch {
      // Error already handled by mutation
    }
  };

  const getTemplate = (key: string): VariableTemplate | undefined => {
    return templates.find((t) => t.key === key);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Title */}
        {title && (
          <div>
            <h2 className="text-sm font-medium text-[#cccccc]">{title}</h2>
            {description && <p className="text-xs text-[#858585] mt-1">{description}</p>}
          </div>
        )}

        {/* Variable List */}
        <div className="space-y-3">
          {variables.map((variable, index) => {
            const template = getTemplate(variable.key);
            const isReadOnly = template?.readOnly || false;

            return (
              <div key={index} className="space-y-2">
                {/* Label */}
                {template && (
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-[#858585]">{template.label}</label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleCopyKey(variable.key)}
                          className="flex items-center gap-1.5 text-xs bg-[#2d2d30] border border-[#3e3e42] px-2 py-0.5 rounded text-[#3794ff] font-mono hover:bg-[#37373d] hover:border-[#3794ff]/50 transition-colors cursor-pointer group"
                        >
                          <Hash className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                          <span>{variable.key}</span>
                          <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="flex items-center gap-1.5">
                          <span>Environment variable key</span>
                          <span className="text-[#858585]">• Click to copy</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}

                {/* Input Row */}
                <div className="flex items-center gap-2 group">
                  {/* Key Input (if no template) */}
                  {!template && (
                    <Input
                      placeholder="KEY_NAME"
                      value={variable.key}
                      onChange={(e) =>
                        handleUpdate(
                          index,
                          'key',
                          e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')
                        )
                      }
                      disabled={!canUpdate || saving}
                      className="flex-1 bg-[#3c3c3c] border-[#3e3e42] text-[#cccccc] font-mono text-sm h-9 focus:border-[#3794ff] focus:ring-1 focus:ring-[#3794ff]"
                    />
                  )}

                  {/* Value Input */}
                  <div className="flex-1 relative">
                    <Input
                      type={variable.isSecret && !showSecrets[index] ? 'password' : 'text'}
                      placeholder={template?.placeholder || 'value'}
                      value={variable.value}
                      onChange={(e) => handleUpdate(index, 'value', e.target.value)}
                      disabled={!canUpdate || saving || isReadOnly}
                      className="bg-[#3c3c3c] border-[#3e3e42] text-[#cccccc] text-sm h-9 pr-8 focus:border-[#3794ff] focus:ring-1 focus:ring-[#3794ff] font-mono"
                    />
                    {variable.isSecret && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecrets({ ...showSecrets, [index]: !showSecrets[index] })
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#858585] hover:text-[#cccccc]"
                      >
                        {showSecrets[index] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Generate Button */}
                  {template?.generateValue && (
                    <Button
                      type="button"
                      onClick={() => handleGenerate(index, template.generateValue!)}
                      disabled={!canUpdate || saving}
                      variant="ghost"
                      size="sm"
                      className="text-[#cccccc] hover:text-white hover:bg-[#37373d] h-9 px-3"
                    >
                      Generate
                    </Button>
                  )}

                  {/* Delete Button (if no template or custom variables allowed) */}
                  {(!template || allowCustomVariables) && (
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      disabled={!canUpdate || saving}
                      className="text-[#858585] hover:text-[#f48771] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Description */}
                {template?.description && (
                  <p className="text-xs text-[#858585] pl-0">{template.description}</p>
                )}
              </div>
            );
          })}

          {/* Empty State */}
          {variables.length === 0 && (
            <div className="py-8 text-center text-sm text-[#858585]">
              No secrets configured yet.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#3e3e42]">
          {allowCustomVariables && (
            <Button
              type="button"
              onClick={handleAdd}
              disabled={!canUpdate || saving}
              variant="ghost"
              size="sm"
              className="text-[#cccccc] hover:text-white hover:bg-[#37373d] h-8"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Variable
            </Button>
          )}

          <div className="flex-1" />

          <Button
            type="button"
            onClick={handleSaveClick}
            disabled={!canUpdate || saving || !hasChanges}
            className="bg-[#3794ff] hover:bg-[#4fc1ff] text-white h-8"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Status Message */}
        {!canUpdate && (
          <p className="text-xs text-[#f48771]">
            Environment variables can only be updated when the project is running
          </p>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-[#252526] border-[#3e3e42]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#cccccc]">
              Confirm Environment Variable Changes
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#858585]">
              Updating environment variables will restart your application. All active terminal
              sessions will be lost. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#3c3c3c] border-[#3e3e42] text-[#cccccc] hover:bg-[#37373d]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSave}
              className="bg-[#3794ff] hover:bg-[#4fc1ff] text-white"
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
