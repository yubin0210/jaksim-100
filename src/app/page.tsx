import { HomeClient } from '@/components/HomeClient';
import { listRoomsOverview } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const overview = listRoomsOverview();

  return (
    <HomeClient
      initialMyRooms={overview.myRooms}
      weekRhythm={overview.weekRhythm}
    />
  );
}
