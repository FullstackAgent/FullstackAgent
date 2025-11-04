import bcrypt from 'bcryptjs'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import GitHub from 'next-auth/providers/github'

import { prisma } from '@/lib/db'
import { isJWTExpired, parseSealosJWT } from '@/lib/jwt'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'lib/auth' })

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
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
    }),
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
          // User exists - only update sealosKubeconfig, NOT sealosId
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

          // Update KUBECONFIG in UserConfig
          await prisma.userConfig.upsert({
            where: {
              userId_key: {
                userId: existingIdentity.user.id,
                key: 'KUBECONFIG',
              },
            },
            create: {
              userId: existingIdentity.user.id,
              key: 'KUBECONFIG',
              value: sealosKubeconfig,
              category: 'kc',
              isSecret: true,
            },
            update: {
              value: sealosKubeconfig,
            },
          })

          return {
            id: existingIdentity.user.id,
            name: existingIdentity.user.name || sealosUserId,
          }
        } else {
          // Create new user - use sealosId as name
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
                create: {
                  key: 'KUBECONFIG',
                  value: sealosKubeconfig,
                  category: 'kc',
                  isSecret: true,
                },
              },
            },
          })

          return {
            id: newUser.id,
            name: newUser.name || sealosUserId,
          }
        }
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'repo read:user',
        },
      },
    }),
  ],
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
