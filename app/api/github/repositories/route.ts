import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createGitHubClient } from '@/lib/github'

// Get user's GitHub repositories
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get GitHub identity with token
    const githubIdentity = await prisma.userIdentity.findFirst({
      where: {
        userId: session.user.id,
        provider: 'GITHUB',
      },
    })

    if (!githubIdentity) {
      return NextResponse.json(
        { error: 'GitHub account not connected. Please sign in with GitHub.' },
        { status: 400 }
      )
    }

    const metadata = githubIdentity.metadata as { token?: string }
    const githubToken = metadata.token

    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token not found. Please reconnect your GitHub account.' },
        { status: 400 }
      )
    }

    // Fetch data from GitHub API in parallel
    const githubClient = createGitHubClient(githubToken)
    const [githubUser, allRepos, organizations] = await Promise.all([
      githubClient.getUser(),
      githubClient.listRepos(),
      githubClient.listOrganizations(),
    ])

    // Build accounts array (personal account + organizations)
    const accounts = [
      {
        login: githubUser.login,
        type: 'User' as const,
        avatarUrl: githubUser.avatar_url,
        name: githubUser.name,
      },
      ...organizations.map((org) => ({
        login: org.login,
        type: 'Organization' as const,
        avatarUrl: org.avatar_url,
        name: org.login,
      })),
    ]

    // Format repositories with owner information
    const formattedRepos = allRepos.map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      description: repo.description,
      owner: {
        login: repo.owner.login,
        type: repo.owner.type,
      },
    }))

    return NextResponse.json({
      accounts,
      repositories: formattedRepos,
      count: formattedRepos.length,
    })
  } catch (error: any) {
    console.error('Error fetching GitHub repositories:', error)

    // Handle GitHub API rate limiting
    if (error.status === 403) {
      return NextResponse.json(
        { error: 'GitHub API rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // Handle invalid or expired token
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'GitHub token is invalid or expired. Please reconnect your GitHub account.' },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: 'Failed to fetch GitHub repositories' }, { status: 500 })
  }
}
