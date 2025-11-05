import { Octokit } from '@octokit/rest'

export class GitHubService {
  private octokit: Octokit

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
    })
  }

  async getUser() {
    const { data } = await this.octokit.users.getAuthenticated()
    return data
  }

  async listRepos() {
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
      affiliation: 'owner,organization_member',
    })
    return data
  }

  async listOrganizations() {
    const { data } = await this.octokit.orgs.listForAuthenticatedUser({
      per_page: 100,
    })
    return data
  }

  async createRepo(name: string, description?: string, isPrivate: boolean = false) {
    const { data } = await this.octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: true,
    })
    return data
  }

  async getRepo(owner: string, repo: string) {
    const { data } = await this.octokit.repos.get({
      owner,
      repo,
    })
    return data
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ) {
    const contentBase64 = Buffer.from(content).toString('base64')

    const params: {
      owner: string
      repo: string
      path: string
      message: string
      content: string
      sha?: string
    } = {
      owner,
      repo,
      path,
      message,
      content: contentBase64,
    }

    if (sha) {
      params.sha = sha
    }

    const { data } = await this.octokit.repos.createOrUpdateFileContents(params)
    return data
  }

  async getFileContent(owner: string, repo: string, path: string) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      })

      if ('content' in data && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf8')
        return {
          content,
          sha: data.sha,
        }
      }

      return null
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        (error as { status: number }).status === 404
      ) {
        return null
      }
      throw error
    }
  }

  async createTree(owner: string, repo: string, files: { path: string; content: string }[]) {
    // Get the latest commit
    const { data: ref } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: 'heads/main',
    })

    const latestCommitSha = ref.object.sha

    // Get the tree of the latest commit
    const { data: commit } = await this.octokit.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha,
    })

    const baseTreeSha = commit.tree.sha

    // Create blobs for each file
    const tree = await Promise.all(
      files.map(async (file) => {
        const { data: blob } = await this.octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        })

        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        }
      })
    )

    // Create new tree
    const { data: newTree } = await this.octokit.git.createTree({
      owner,
      repo,
      tree,
      base_tree: baseTreeSha,
    })

    return newTree
  }

  async createCommit(
    owner: string,
    repo: string,
    message: string,
    treeSha: string,
    parentSha: string
  ) {
    const { data } = await this.octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: treeSha,
      parents: [parentSha],
    })

    return data
  }

  async updateRef(owner: string, repo: string, ref: string, sha: string) {
    const { data } = await this.octokit.git.updateRef({
      owner,
      repo,
      ref: ref.replace('refs/', ''),
      sha,
    })

    return data
  }

  async pushFiles(
    owner: string,
    repo: string,
    files: { path: string; content: string }[],
    message: string
  ) {
    // Get the latest commit
    const { data: ref } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: 'heads/main',
    })

    const latestCommitSha = ref.object.sha

    // Create tree with all files
    const tree = await this.createTree(owner, repo, files)

    // Create commit
    const commit = await this.createCommit(owner, repo, message, tree.sha, latestCommitSha)

    // Update ref
    await this.updateRef(owner, repo, 'heads/main', commit.sha)

    return commit
  }
}

export function createGitHubClient(token: string) {
  return new GitHubService(token)
}
