# Шаг 3: Lobby-страница и Whiteboard (Инструкция для ИИ-агента)

**КОНТЕКСТ ДЛЯ АГЕНТА:** Реализовать два состояния страницы комнаты: Lobby → Workspace. Whiteboard использует `@tldraw/sync` (нативный провайдер), без Yjs.

## 3.1 Структура файлов, которые нужно создать:
```
app/src/
  app/
    [roomId]/
      page.tsx          ← Точка входа: Lobby или Workspace
  components/
    Lobby.tsx           ← Предварительная страница
    Workspace.tsx       ← Хост для Whiteboard + VideoOverlay
    Whiteboard.tsx      ← tldraw с @tldraw/sync
    VideoOverlay.tsx    ← Плавающие видео-карточки
  hooks/
    useWebRTC.ts        ← WebRTC логика
```

## 3.2 `app/src/app/[roomId]/page.tsx`
```tsx
'use client'
import { useState } from 'react';
import Lobby from '@/components/Lobby';
import Workspace from '@/components/Workspace';

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const [joined, setJoined] = useState(false);
  const [userName, setUserName] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleJoin = (name: string, mediaStream: MediaStream) => {
    setUserName(name);
    setStream(mediaStream);
    setJoined(true);
  };

  if (!joined) return <Lobby roomId={params.roomId} onJoin={handleJoin} />;
  return <Workspace roomId={params.roomId} userName={userName} localStream={stream!} />;
}
```

## 3.3 `app/src/components/Lobby.tsx`
Lobby должен:
- Запрашивать `navigator.mediaDevices.getUserMedia({ video: true, audio: true })` при монтировании.
- Отображать превью своей камеры через `<video autoPlay muted playsInline>`.
- Иметь инпут для имени (обязательное поле).
- Кнопки Toggle Cam / Toggle Mic (включают/выключают треки `MediaStream`).
- Кнопка "Join Room" — вызывает `onJoin(name, stream)`.
- Использовать минималистичный дизайн (Tailwind: `flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4 p-8`).

## 3.4 `app/src/components/Whiteboard.tsx`
Использовать **нативный** `@tldraw/sync` провайдер:
```tsx
'use client'
import { Tldraw, TLStore } from '@tldraw/tldraw';
import { useSyncDemo } from '@tldraw/sync'; // или useSync из @tldraw/sync
import '@tldraw/tldraw/tldraw.css';

// Агент: прочитай актуальную документацию https://tldraw.dev/docs/sync
// для правильного использования useSync хука с кастомным WebSocket URL.
// Ключевые параметры useSync:
//   uri: process.env.NEXT_PUBLIC_TLDRAW_WS_URL + '/' + roomId
//   assets: ...
// useSync возвращает store, который передаётся прямо в <Tldraw store={store} />

export default function Whiteboard({ roomId }: { roomId: string }) {
  // TODO агент: используй useSync из @tldraw/sync
  // const store = useSync({ uri: `${process.env.NEXT_PUBLIC_TLDRAW_WS_URL}/${roomId}` })
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {/* <Tldraw store={store} /> */}
    </div>
  );
}
```

## 3.5 `app/src/components/Workspace.tsx`
Компонент объединяет Whiteboard и VideoOverlay:
```tsx
'use client'
import Whiteboard from './Whiteboard';
import VideoOverlay from './VideoOverlay';
import { useWebRTC } from '@/hooks/useWebRTC';
import { io } from 'socket.io-client';
import { useEffect, useRef } from 'react';

export default function Workspace({ roomId, userName, localStream }: {
  roomId: string; userName: string; localStream: MediaStream;
}) {
  const socketRef = useRef(io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost'));
  const { peers, toggleVideo, toggleAudio } = useWebRTC(roomId, userName, localStream, socketRef.current);

  useEffect(() => {
    socketRef.current.emit('join-room', { roomId, userName });
    return () => { socketRef.current.disconnect(); };
  }, [roomId, userName]);

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
```
