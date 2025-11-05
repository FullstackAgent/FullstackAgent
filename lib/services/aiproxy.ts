import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'lib/services/aiproxy' })

// Aiproxy token response type
type TokenInfo = {
  key: string
  name: string
  [key: string]: string
}

type AiproxyResponse = {
  code: number
  message?: string
  data?: TokenInfo
  error?: string
}

type AiproxyTokenResponse = {
  token: TokenInfo
  anthropicBaseUrl: string
}

/**
 * Create aiproxy token for user
 * @param name - Token name
 * @param kubeconfig - User's kubeconfig string
 * @returns Token info with key
 */
export async function createAiproxyToken(
  name: string,
  kubeconfig: string
): Promise<AiproxyTokenResponse | null> {
  // Check if required environment variables are set
  const aiproxyEndpoint = process.env.AIPROXY_ENDPOINT
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL

  if (!aiproxyEndpoint || !anthropicBaseUrl) {
    logger.warn('AIPROXY_ENDPOINT or ANTHROPIC_BASE_URL not configured, skipping token creation')
    return null
  }

  try {
    // Create token via aiproxy API
    const url = `${aiproxyEndpoint}/api/keyhub`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        kc: kubeconfig,
      }),
    })

    if (!response.ok) {
      logger.error(`Aiproxy API returned status ${response.status}`)
      return null
    }

    const result: AiproxyResponse = await response.json()

    if (result.code !== 200 || !result.data) {
      logger.error(`Aiproxy token creation failed: ${result.message || result.error}`)
      return null
    }

    return {
      token: result.data,
      anthropicBaseUrl: anthropicBaseUrl,
    }
  } catch (error) {
    logger.error(`Error creating aiproxy token: ${error}`)
    return null
  }
}

/**
 * Load environment variables for sandbox from user config
 * @param userId - User ID
 * @returns Environment variables object with ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN
 */
export async function loadEnvVarsForSandbox(userId: string): Promise<Record<string, string>> {
  const userConfig = await prisma.userConfig.findMany({
    where: {
      userId,
      key: {
        in: ['ANTHROPIC_API_KEY', 'ANTHROPIC_API'],
      },
    },
  })

  const envVars: Record<string, string> = {}

  // Find ANTHROPIC_API_KEY and map to ANTHROPIC_AUTH_TOKEN
  const apiKey = userConfig.find((config) => config.key === 'ANTHROPIC_API_KEY')
  if (apiKey?.value) {
    envVars.ANTHROPIC_AUTH_TOKEN = apiKey.value
  }

  // Find ANTHROPIC_API and map to ANTHROPIC_BASE_URL
  const apiBaseUrl = userConfig.find((config) => config.key === 'ANTHROPIC_API')
  if (apiBaseUrl?.value) {
    envVars.ANTHROPIC_BASE_URL = apiBaseUrl.value
  }

  return envVars
}
