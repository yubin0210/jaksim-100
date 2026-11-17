import { notFound, redirect } from 'next/navigation';
import { RoomBoardClient } from '@/components/RoomBoardClient';
import { getAuthenticatedUser } from '@/lib/auth';
import { getRoomDetail } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/auth');
  }

  const { id } = await params;
  const detail = await getRoomDetail(user, id);
  if (!detail) notFound();

  return <RoomBoardClient initialDetail={detail} />;
}
