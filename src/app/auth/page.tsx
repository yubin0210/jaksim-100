import { redirect } from 'next/navigation';
import { AuthClient } from '@/components/AuthClient';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AuthPage() {
  const user = await getAuthenticatedUser();
  if (user) {
    redirect('/');
  }

  return <AuthClient />;
}
