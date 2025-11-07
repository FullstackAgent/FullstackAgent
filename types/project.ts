export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updatedAt: string;
  githubRepo: string | null;
}