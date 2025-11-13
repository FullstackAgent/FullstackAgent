/**
 * Secrets Configuration Page
 * Manage sensitive environment variables and API keys
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

function SecretsPageContent() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: envData, isLoading: envLoading } = useEnvironmentVariables(projectId);
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const batchUpdate = useBatchUpdateEnvironmentVariables(projectId);

  const secretVars = envData?.secret || [];

  const handleSave = async (
    variables: Array<{ key: string; value: string; isSecret?: boolean }>
  ) => {
    await batchUpdate.mutateAsync({
      category: 'secret',
      variables: variables.map((v) => ({ ...v, isSecret: true })),
    });
  };

  return (
    <ConfigLayout
      title="Secret Configuration"
      description="Manage sensitive environment variables and API keys"
      loading={envLoading || projectLoading}
    >
      <div className="space-y-6">
        {/* Secrets Section */}
        <EnvVarSection
          title="Secret Variables"
          description="Store sensitive data like API keys, tokens, and passwords"
          variables={secretVars.map((v) => ({ ...v, isSecret: true }))}
          sandboxes={project?.sandboxes || []}
          onSave={handleSave}
          saving={batchUpdate.isPending}
          allowCustomVariables={true}
        />

        {/* Security Notice */}
        <div className="p-4 bg-[#252526] border border-[#3e3e42] rounded">
          <h3 className="text-xs font-medium text-[#cccccc] mb-2">Security Best Practices</h3>
          <ul className="text-xs text-[#858585] space-y-1 list-disc list-inside">
            <li>All secret values are masked by default for security</li>
            <li>Never commit secrets to Git</li>
            <li>Rotate secrets regularly to maintain security</li>
            {/*<li>Use different secrets for development and production environments</li>*/}
            <li>Limit access to secrets to only those who need them</li>
          </ul>
        </div>
      </div>
    </ConfigLayout>
  );
}

export default SecretsPageContent;
