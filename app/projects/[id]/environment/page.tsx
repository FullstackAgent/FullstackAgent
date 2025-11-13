/**
 * Environment Variables Configuration Page
 * Configure custom environment variables
 * VSCode Dark Modern style
 */

'use client';

import { useParams } from 'next/navigation';

import { ConfigLayout } from '@/components/config/config-layout';
import { EnvVarSection } from '@/components/config/env-var-section';
import {
  useBatchUpdateEnvironmentVariables,
  useEnvironmentVariables,
} from '@/hooks/use-environment-variables';
import { useProject } from '@/hooks/use-project';

function EnvironmentPageContent() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: envData, isLoading: envLoading } = useEnvironmentVariables(projectId);
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const batchUpdate = useBatchUpdateEnvironmentVariables(projectId);

  const generalVars = envData?.general || [];

  const handleSave = async (
    variables: Array<{ key: string; value: string; isSecret?: boolean }>
  ) => {
    await batchUpdate.mutateAsync({
      category: 'general',
      variables,
    });
  };

  return (
    <ConfigLayout
      title="Environment Variables"
      description="Configure environment variables for your application"
      loading={envLoading || projectLoading}
    >
      <div className="space-y-6">
        {/* Environment Variables Section */}
        <EnvVarSection
          title="Environment Variables"
          description="Add application-specific environment variables"
          variables={generalVars}
          sandboxes={project?.sandboxes || []}
          onSave={handleSave}
          saving={batchUpdate.isPending}
          allowCustomVariables={true}
        />

        {/* Usage Information */}
        <div className="p-4 bg-[#252526] border border-[#3e3e42] rounded">
          <h3 className="text-xs font-medium text-[#cccccc] mb-2">Environment Variable Usage</h3>
          <ul className="text-xs text-[#858585] space-y-1 list-disc list-inside">
            <li>Environment variables are available in your application via process.env</li>
            <li>Changes require an application restart to take effect</li>
            <li>For authentication providers, use the Authentication page</li>
            <li>For payment providers, use the Payment page</li>
            <li>For sensitive data like API keys, use the Secrets page</li>
          </ul>
        </div>
      </div>
    </ConfigLayout>
  );
}

export default EnvironmentPageContent;
