import { notFound } from 'next/navigation';
import { RoomBoardClient } from '@/components/RoomBoardClient';
import { getRoomDetail } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = getRoomDetail(id);
  if (!detail) notFound();

  return <RoomBoardClient initialDetail={detail} />;
}
