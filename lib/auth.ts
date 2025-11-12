import bcrypt from 'bcryptjs'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import GitHub from 'next-auth/providers/github'

import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { isJWTExpired, parseSealosJWT } from '@/lib/jwt'
import { updateUserKubeconfig } from '@/lib/k8s/k8s-service-helper'
import { logger as baseLogger } from '@/lib/logger'
import { createAiproxyToken } from '@/lib/services/aiproxy'

const logger = baseLogger.child({ module: 'lib/auth' })

// Build providers array dynamically based on feature flags
const buildProviders = () => {
  const providers = []

  // Password authentication (Credentials)
  if (env.ENABLE_PASSWORD_AUTH) {
    logger.info('Password authentication is ENABLED')
    providers.push(
      Credentials({
        name: 'credentials',
        credentials: {
          username: { label: 'Username', type: 'text' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          if (!credentials?.username || !credentials?.password) {
            logger.info('Missing username or password')
            return null
          }

          const username = credentials.username as string
          const password = credentials.password as string

          try {
            // Find user by username (providerUserId in PASSWORD identity)
            const identity = await prisma.userIdentity.findUnique({
              where: {
                unique_provider_user: {
                  provider: 'PASSWORD',
                  providerUserId: username,
                },
              },
              include: {
                user: true,
              },
            })

            if (!identity) {
              // User doesn't exist - auto-register
              logger.info(`[Auto-Register] Creating new user: ${username}`)
              const passwordHash = await bcrypt.hash(password, 10)

              const newUser = await prisma.user.create({
                data: {
                  name: username,
                  identities: {
                    create: {
                      provider: 'PASSWORD',
                      providerUserId: username,
                      metadata: { passwordHash },
                      isPrimary: true,
                    },
                  },
                },
              })

              logger.info(`[Auto-Register] User created successfully: ${newUser.id}`)

              return {
                id: newUser.id,
                name: newUser.name || username,
              }
            }

            // User exists - verify password
            const metadata = identity.metadata as { passwordHash?: string }
            const passwordHash = metadata.passwordHash

            if (!passwordHash) {
              logger.warn(`No password hash found for user: ${username}`)
              return null
            }

            const passwordMatch = await bcrypt.compare(password, passwordHash)
            if (!passwordMatch) {
              logger.warn(`[Auth Failed] Invalid password for user: ${username}`)
              return null
            }

            // Authentication successful
            logger.info(`[Auth Success] User logged in: ${username}`)
            return {
              id: identity.user.id,
              name: identity.user.name || username,
            }
          } catch (error) {
            logger.error(`[Auth Error] Error in authorize: ${error}`)
            return null
          }
        },
      })
    )
  } else {
    logger.info('Password authentication is DISABLED')
  }

  // Sealos authentication (Credentials)
  if (env.ENABLE_SEALOS_AUTH) {
    logger.info('Sealos authentication is ENABLED')
    providers.push(
      Credentials({
        id: 'sealos',
        name: 'sealos',
        credentials: {
          sealosToken: { label: 'Sealos Token', type: 'text' },
          sealosKubeconfig: { label: 'Sealos Kubeconfig', type: 'text' },
        },
        async authorize(credentials) {
          if (!credentials?.sealosToken) {
            throw new Error('SealosTokenRequired')
          }

          const sealosToken = credentials.sealosToken as string
          const sealosKubeconfig = credentials.sealosKubeconfig as string

          // Validate JWT token
          if (!process.env.SEALOS_JWT_SECRET) {
            logger.error('SEALOS_JWT_SECRET is not configured')
            throw new Error('SealosConfigurationError')
          }

          // Check if JWT is expired
          if (isJWTExpired(sealosToken)) {
            throw new Error('SealosTokenExpired')
          }

          // Parse and verify Sealos JWT
          let sealosJwtPayload
          try {
            sealosJwtPayload = parseSealosJWT(sealosToken, process.env.SEALOS_JWT_SECRET)
          } catch (error) {
            logger.error(`Error parsing Sealos JWT: ${error}`)
            throw new Error('SealosTokenInvalid')
          }

          const sealosUserId = sealosJwtPayload.userId

          // Find existing Sealos identity
          const existingIdentity = await prisma.userIdentity.findUnique({
            where: {
              unique_provider_user: {
                provider: 'SEALOS',
                providerUserId: sealosUserId,
              },
            },
            include: {
              user: true,
            },
          })

          if (existingIdentity) {
            // User exists - only update sealosKubeconfig and aiproxy token, NOT sealosId
            const existingMetadata = existingIdentity.metadata as {
              sealosId?: string
              sealosKubeconfig?: string
            }
            await prisma.userIdentity.update({
              where: { id: existingIdentity.id },
              data: {
                metadata: {
                  sealosId: existingMetadata.sealosId || sealosUserId, // Keep existing sealosId
                  sealosKubeconfig: sealosKubeconfig, // Update kubeconfig
                },
              },
            })

            // Update KUBECONFIG in UserConfig using helper function
            // This will automatically clear the cached service instance
            await updateUserKubeconfig(existingIdentity.user.id, sealosKubeconfig)

            // Create aiproxy token
            try {
              const tokenInfo = await createAiproxyToken(
                `fullstackagent-${sealosUserId}`,
                sealosKubeconfig
              )

              if (tokenInfo?.token?.key && tokenInfo.anthropicBaseUrl) {
                // Store ANTHROPIC_API_KEY in UserConfig
                await prisma.userConfig.upsert({
                  where: {
                    userId_key: {
                      userId: existingIdentity.user.id,
                      key: 'ANTHROPIC_API_KEY',
                    },
                  },
                  create: {
                    userId: existingIdentity.user.id,
                    key: 'ANTHROPIC_API_KEY',
                    value: tokenInfo.token.key,
                    category: 'anthropic',
                    isSecret: true,
                  },
                  update: {
                    value: tokenInfo.token.key,
                  },
                })

                // Store ANTHROPIC_API (base URL) in UserConfig
                await prisma.userConfig.upsert({
                  where: {
                    userId_key: {
                      userId: existingIdentity.user.id,
                      key: 'ANTHROPIC_API',
                    },
                  },
                  create: {
                    userId: existingIdentity.user.id,
                    key: 'ANTHROPIC_API',
                    value: tokenInfo.anthropicBaseUrl,
                    category: 'anthropic',
                    isSecret: false,
                  },
                  update: {
                    value: tokenInfo.anthropicBaseUrl,
                  },
                })
              }
            } catch (error) {
              logger.error(`Failed to create aiproxy token for user ${sealosUserId}: ${error}`)
              // Don't fail authentication if token creation fails
            }

            return {
              id: existingIdentity.user.id,
              name: existingIdentity.user.name || sealosUserId,
            }
          } else {
            // Create new user - use sealosId as name

            // Try to create aiproxy token first
            let aiproxyTokenInfo = null
            try {
              aiproxyTokenInfo = await createAiproxyToken(
                `fullstackagent-${sealosUserId}`,
                sealosKubeconfig
              )
            } catch (error) {
              logger.error(`Failed to create aiproxy token for new user ${sealosUserId}: ${error}`)
            }

            // Prepare configs array (excluding KUBECONFIG, which will be set via updateUserKubeconfig)
            const configs: Array<{
              key: string
              value: string
              category: string
              isSecret: boolean
            }> = []

            // Add aiproxy configs if token was created successfully
            if (aiproxyTokenInfo?.token?.key && aiproxyTokenInfo.anthropicBaseUrl) {
              configs.push({
                key: 'ANTHROPIC_API_KEY',
                value: aiproxyTokenInfo.token.key,
                category: 'anthropic',
                isSecret: true,
              })
              configs.push({
                key: 'ANTHROPIC_API',
                value: aiproxyTokenInfo.anthropicBaseUrl,
                category: 'anthropic',
                isSecret: false,
              })
            }

            const newUser = await prisma.user.create({
              data: {
                name: sealosUserId, // Use sealosId as username
                identities: {
                  create: {
                    provider: 'SEALOS',
                    providerUserId: sealosUserId,
                    metadata: {
                      sealosId: sealosUserId,
                      sealosKubeconfig: sealosKubeconfig,
                    },
                    isPrimary: true,
                  },
                },
                configs: {
                  create: configs,
                },
              },
            })

            // Set KUBECONFIG using helper function
            // This will automatically clear the cached service instance
            await updateUserKubeconfig(newUser.id, sealosKubeconfig)

            return {
              id: newUser.id,
              name: newUser.name || sealosUserId,
            }
          }
        },
      })
    )
  } else {
    logger.info('Sealos authentication is DISABLED')
  }

  // GitHub OAuth
  if (env.ENABLE_GITHUB_AUTH) {
    logger.info('GitHub authentication is ENABLED')
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      logger.warn(
        'GitHub authentication is enabled but GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing'
      )
    } else {
      providers.push(
        GitHub({
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          authorization: {
            params: {
              scope: 'repo read:user',
            },
          },
        })
      )
    }
  } else {
    logger.info('GitHub authentication is DISABLED')
  }

  if (providers.length === 0) {
    logger.error('No authentication providers are enabled! At least one provider must be enabled.')
  }

  return providers
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: buildProviders(),
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'github') {
        try {
          const githubId = account.providerAccountId
          const githubToken = account.access_token
          const scope = account.scope || 'repo read:user'

          // Check if identity exists
          const existingIdentity = await prisma.userIdentity.findUnique({
            where: {
              unique_provider_user: {
                provider: 'GITHUB',
                providerUserId: githubId,
              },
            },
            include: {
              user: true,
            },
          })

          if (existingIdentity) {
            // Update GitHub token in metadata
            await prisma.userIdentity.update({
              where: { id: existingIdentity.id },
              data: {
                metadata: {
                  token: githubToken,
                  scope,
                },
              },
            })

            // Set user info for JWT callback
            user.id = existingIdentity.user.id
            user.name = existingIdentity.user.name
          } else {
            // Create new user with GitHub identity
            const newUser = await prisma.user.create({
              data: {
                name:
                  (profile?.name as string) ||
                  (profile?.login as string) ||
                  user.name ||
                  'GitHub User',
                identities: {
                  create: {
                    provider: 'GITHUB',
                    providerUserId: githubId,
                    metadata: {
                      token: githubToken,
                      scope,
                    },
                    isPrimary: true,
                  },
                },
              },
            })

            user.id = newUser.id
            user.name = newUser.name
          }
        } catch (error) {
          logger.error(`Error in GitHub signIn callback: ${error}`)
          return false
        }
      }
      return true
    },
    async jwt({ token, user }) {
      // On initial sign in, store minimal user data in JWT
      if (user) {
        token.id = user.id
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      // Pass user data from JWT to session
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.name = token.name as string | null | undefined
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
  },
  cookies: {
    // Configure cookies for iframe support (Sealos environment)
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'none', // Required for iframe cross-origin access
        path: '/',
        secure: true, // Required when sameSite is 'none'
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
  },
  // Use secure cookies in production
  useSecureCookies: process.env.NODE_ENV === 'production',
  pages: {
    signIn: '/login',
    error: '/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
})

// Extend NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
    }
  }

  interface User {
    id: string
    name?: string | null
  }
}

import 'next-auth/jwt'

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    name?: string | null
  }
}
