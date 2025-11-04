import { redirect } from 'next/navigation';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Redirect to terminal page (main view)
  redirect(`/projects/${id}/terminal`);
}
