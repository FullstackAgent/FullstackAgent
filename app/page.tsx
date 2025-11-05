import { HomePage } from '@/components/home-page';

export default async function Page() {
  // Always render HomePage - it handles all states internally:
  // - Authenticated users: Show marketing page with "Go to Projects" button
  // - Unauthenticated users: Show marketing page with "Login" button
  // - Sealos environment: Show marketing page with auto-auth overlay
  return <HomePage />;
}
