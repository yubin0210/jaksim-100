import { ExploreClient } from '@/components/ExploreClient';
import { listRoomsOverview } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export default function ExplorePage() {
  const overview = listRoomsOverview();

  return <ExploreClient initialRooms={overview.exploreRooms} />;
}
