# Шаг 2: Разработка сервера (Инструкция для ИИ-агента)

**КОНТЕКСТ ДЛЯ АГЕНТА:** Сервер объединяет два независимых слоя на одном HTTP-сервере и порту 3001:
1. **Socket.io** — WebRTC signaling + список участников комнаты.
2. **@tldraw/sync** — нативный WebSocket-сервер для синхронизации доски tldraw.

Persistence: при каждом обновлении состояния tldraw-документа делать дамп через `Y.encodeStateAsUpdate` (или аналогичный механизм `@tldraw/sync-core`) в `data/board_state.json`. При перезапуске — читать и применять этот дамп.

## 2.1 Создай `server/index.js` (полный рабочий каркас):

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Импорт из @tldraw/sync-core
// Агент обязан прочитать актуальную документацию @tldraw/sync для правильного
// импорта createTLSyncServer или аналогичного API.
const { TLSocketServerHandler } = require('@tldraw/sync-core');

const app = express();
app.get('/health', (_, res) => res.json({ ok: true }));

const server = http.createServer(app);

// --- Socket.io (Signaling + Rooms) ---
const io = new Server(server, { cors: { origin: '*'}, path: '/socket.io' });

const rooms = {}; // { roomId: { [socketId]: { userName } } }

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);
    currentRoom = roomId;
    if (!rooms[roomId]) rooms[roomId] = {};
    rooms[roomId][socket.id] = { userName };
    // Сообщаем остальным участникам о новом пользователе
    socket.to(roomId).emit('user-joined', { userId: socket.id, userName });
    // Отправляем новому пользователю список существующих участников
    socket.emit('room-users', rooms[roomId]);
  });

  socket.on('webrtc-offer',         ({ target, offer })     => io.to(target).emit('webrtc-offer',         { source: socket.id, offer }));
  socket.on('webrtc-answer',        ({ target, answer })    => io.to(target).emit('webrtc-answer',        { source: socket.id, answer }));
  socket.on('webrtc-ice-candidate', ({ target, candidate }) => io.to(target).emit('webrtc-ice-candidate', { source: socket.id, candidate }));

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom][socket.id];
      socket.to(currentRoom).emit('user-left', socket.id);
    }
  });
});

// --- @tldraw/sync WebSocket сервер ---
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'board_state.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const wss = new WebSocket.Server({ noServer: true });

// Агент должен здесь подключить TLSocketServerHandler (или официальный API sync-core)
// и настроить: 
// 1. Восстановление состояния из STATE_FILE при первом подключении к комнате
// 2. Периодический (или по изменению) дамп состояния обратно в STATE_FILE

server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith('/tldraw-sync')) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }
});

server.listen(3001, () => console.log('Server listening on port 3001'));
```

**Ключевые требования к реализации агента:**
- `rooms` хранится только в памяти (не в файле).
- Состояние tldraw-документа сохраняется в `data/board_state.json` в бинарном или base64 формате (через `encodeStateAsUpdate`), загружается при первом открытии комнаты.
- Не использовать Yjs напрямую — только API `@tldraw/sync-core`.
