import { redirect } from 'next/navigation';
import { AuthClient } from '@/components/AuthClient';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string | string[] }>;
}) {
  const user = await getAuthenticatedUser();
  if (user) {
    redirect('/');
  }

  const { confirmation } = await searchParams;
  const notice = confirmation === 'login'
    ? '가입한 이메일과 비밀번호로 로그인해 주세요.'
    : confirmation === 'link'
      ? '인증 링크가 만료됐거나 이미 사용됐을 수 있어요. 이미 인증했다면 바로 로그인해 주세요.'
      : null;

  return <AuthClient initialNotice={notice} />;
}
