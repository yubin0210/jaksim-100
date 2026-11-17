import { redirect } from 'next/navigation';
import { ExploreClient } from '@/components/ExploreClient';
import { getAuthenticatedUser } from '@/lib/auth';
import { listRoomsOverview } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/auth');
  }

  const overview = await listRoomsOverview(user);

  return <ExploreClient initialRooms={overview.exploreRooms} />;
}
