'use client';
import { useState } from 'react';
import Lobby from '@/components/Lobby';
import Workspace from '@/components/Workspace';

interface RoomClientProps {
  roomId: string;
}

export default function RoomClient({ roomId }: RoomClientProps) {
  const [joined, setJoined] = useState(false);
  const [userName, setUserName] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleJoin = (name: string, mediaStream: MediaStream) => {
    setUserName(name);
    setStream(mediaStream);
    setJoined(true);
  };

  if (!joined) {
    return <Lobby roomId={roomId} onJoin={handleJoin} />;
  }

  return (
    <Workspace
      roomId={roomId}
      userName={userName}
      localStream={stream!}
    />
  );
}
