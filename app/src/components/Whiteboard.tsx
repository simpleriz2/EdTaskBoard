'use client';
import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { useYjsStore } from '@/hooks/useYjsStore';

interface WhiteboardProps {
  roomId: string;
}

const WS_URL = process.env.NEXT_PUBLIC_TLDRAW_WS_URL || 'ws://localhost/tldraw-sync';

export default function Whiteboard({ roomId }: WhiteboardProps) {
  const storeWithStatus = useYjsStore({
    roomId,
    hostUrl: WS_URL,
  });

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {storeWithStatus.status === 'loading' ? (
        <div className="flex items-center justify-center w-full h-full bg-gray-50 text-gray-500">
          Loading whiteboard...
        </div>
      ) : (
        <Tldraw store={storeWithStatus} />
      )}
    </div>
  );
}
