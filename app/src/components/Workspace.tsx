'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Whiteboard from './Whiteboard';
import VideoOverlay from './VideoOverlay';
import { useWebRTC } from '@/hooks/useWebRTC';

interface WorkspaceProps {
  roomId: string;
  userName: string;
  localStream: MediaStream;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost';

export default function Workspace({ roomId, userName, localStream }: WorkspaceProps) {
  const socketRef = useRef<Socket | null>(null);

  if (!socketRef.current) {
    socketRef.current = io(SOCKET_URL, { path: '/socket.io' });
  }

  const socket = socketRef.current;
  const { peers, toggleVideo, toggleAudio } = useWebRTC(roomId, userName, localStream, socket);

  useEffect(() => {
    socket.emit('join-room', { roomId, userName });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, userName, socket]);

  return (
    <>
      <Whiteboard roomId={roomId} />
      <VideoOverlay
        localStream={localStream}
        peers={peers}
        userName={userName}
        toggleVideo={toggleVideo}
        toggleAudio={toggleAudio}
      />
    </>
  );
}
