'use server'

import { signIn } from '@/lib/auth'

/**
 * Server action for Sealos authentication
 * This bypasses client-side CSRF issues in iframe environments
 */
export async function authenticateWithSealos(
  sealosToken: string,
  sealosKubeconfig: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Sealos Auth Action] Attempting server-side authentication...')

    const result = await signIn('sealos', {
      sealosToken,
      sealosKubeconfig,
      redirect: false,
    })

    if (result?.error) {
      console.error('[Sealos Auth Action] Authentication failed:', result.error)
      return { success: false, error: result.error }
    }

    console.log('[Sealos Auth Action] Authentication successful')
    return { success: true }
  } catch (error) {
    console.error('[Sealos Auth Action] Server error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
