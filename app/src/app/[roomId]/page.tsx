// Server Component — async params are safely awaited here
import RoomClient from '@/components/RoomClient';

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: PageProps) {
  const { roomId } = await params;
  return <RoomClient roomId={roomId} />;
}
