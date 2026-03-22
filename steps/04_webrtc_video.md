# Шаг 4: WebRTC Видеосвязь (Инструкция для ИИ-агента)

**КОНТЕКСТ ДЛЯ АГЕНТА:** Caddy обеспечивает единый хост. WebSocket Socket.io проксируется через `/socket.io/*`, поэтому фронтенд указывает `http://localhost` как базовый URL и socket.io-client самостоятельно использует правильный путь.

## 4.1 Хук `app/src/hooks/useWebRTC.ts`

Хук принимает: `roomId`, `userName`, `localStream`, `socket`.
Возвращает: `{ peers, toggleVideo, toggleAudio }`.

Где `peers` — это `Map<string, { stream: MediaStream; userName: string }>`.

Реализация:
- При получении `room-users` от сервера — создать `RTCPeerConnection` для **каждого** существующего пользователя (инициатор создаёт offer).
- При получении `user-joined` — создать `RTCPeerConnection` для нового пользователя (инициатор: текущий пользователь).
- `toggleVideo` и `toggleAudio` переключают соответствующие треки `localStream`.

Конфигурация ICE:
```typescript
const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: process.env.NEXT_PUBLIC_TURN_URL || 'turn:localhost:3478',
    username: process.env.NEXT_PUBLIC_TURN_USER || 'test',
    credential: process.env.NEXT_PUBLIC_TURN_CRED || 'test',
  },
];
```

> **ВАЖНО для агента:** При создании offer/answer для каждого peer нужно передавать `localStream.getTracks()` в `pc.addTrack(track, localStream)` ДО `createOffer`, иначе видео не появится у получателя.

## 4.2 Компонент `app/src/components/VideoOverlay.tsx`

Props:
```typescript
{
  localStream: MediaStream;
  peers: Map<string, { stream: MediaStream; userName: string }>;
  userName: string;
  toggleVideo: () => void;
  toggleAudio: () => void;
}
```

Требования к реализации:
- Контейнер: `position: fixed; inset: 0; pointer-events: none; z-index: 100`.
- Каждая карточка оборачивается в `<Rnd>` из `react-rnd` с `style={{ pointerEvents: 'auto' }}`.
- Размер карточек по умолчанию: `200x150px`.
- Начальные позиции: локальная в правом нижнем углу (`x: window.innerWidth - 220, y: window.innerHeight - 170`), удалённые — стекируются вверх.
- Поверх каждого `<video>` — полупрозрачный `<div>` с именем пользователя (снизу слева).
- Кнопки "Cam" / "Mic" — только в карточке локального пользователя (в нижнем правом углу карточки).
