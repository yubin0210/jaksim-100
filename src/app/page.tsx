import { redirect } from 'next/navigation';
import { HomeClient } from '@/components/HomeClient';
import { getAuthenticatedUser } from '@/lib/auth';
import { listRoomsOverview } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/auth');
  }

  const overview = await listRoomsOverview(user);

  return (
    <HomeClient
      initialMyRooms={overview.myRooms}
      weekRhythm={overview.weekRhythm}
      userNickname={user.nickname}
    />
  );
}
