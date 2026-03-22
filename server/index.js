const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');
const fs = require('fs');
const path = require('path');

// ─── Setup ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.get('/health', (_, res) => res.json({ ok: true }));

const server = http.createServer(app);

// ─── Persistence ─────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'board_state.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// roomId → { snapshot: object, timer: NodeJS.Timeout | null }
const roomStates = {};

function loadStateFromDisk() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      Object.assign(roomStates, parsed);
      console.log('[persistence] Loaded board states from disk');
    } catch (e) {
      console.error('[persistence] Failed to load state:', e.message);
    }
  }
}

function flushStateToDisk() {
  // Serialize only the snapshot data (strip timers)
  const toSave = {};
  for (const [roomId, state] of Object.entries(roomStates)) {
    toSave[roomId] = { snapshot: state.snapshot };
  }
  fs.writeFile(STATE_FILE, JSON.stringify(toSave), (err) => {
    if (err) console.error('[persistence] Failed to write state:', err.message);
  });
}

loadStateFromDisk();

// Periodic flush every 15 seconds
setInterval(flushStateToDisk, 15_000);

// ─── Socket.io (Signaling + Room management) ─────────────────────────────────
const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// roomId → Map<socketId, { userName }>
const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);
    currentRoom = roomId;

    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    rooms.get(roomId).set(socket.id, { userName });

    // Send existing users list to new joiner
    const existingUsers = {};
    rooms.get(roomId).forEach((data, id) => {
      if (id !== socket.id) existingUsers[id] = data;
    });
    socket.emit('room-users', existingUsers);

    // Notify others of new user
    socket.to(roomId).emit('user-joined', { userId: socket.id, userName });

    console.log(`[room] ${userName} (${socket.id}) joined room "${roomId}"`);
  });

  // WebRTC signaling
  socket.on('webrtc-offer', ({ target, offer }) => {
    io.to(target).emit('webrtc-offer', { source: socket.id, offer });
  });
  socket.on('webrtc-answer', ({ target, answer }) => {
    io.to(target).emit('webrtc-answer', { source: socket.id, answer });
  });
  socket.on('webrtc-ice-candidate', ({ target, candidate }) => {
    io.to(target).emit('webrtc-ice-candidate', { source: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.delete(socket.id);
      if (room.size === 0) rooms.delete(currentRoom);
      socket.to(currentRoom).emit('user-left', socket.id);
      console.log(`[room] ${socket.id} left room "${currentRoom}"`);
    }
  });
});

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', setupWSConnection);

// Upgrade HTTP → WS for /tldraw-sync paths
server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith('/tldraw-sync')) {
    // Map /tldraw-sync/roomId to just /roomId so y-websocket groups by rooms correctly
    const rawRoomId = req.url.split('/')[2] || 'default';
    const roomId = rawRoomId.split('?')[0];
    req.url = `/${roomId}`;
    
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// For now, persistence is handled by raw Socket.io logic if any, or yjs persistence
// If we want real Yjs persistence to disk, y-websocket recommends using y-leveldb.
// For the MVP, we will rely on y-websocket in-memory syncing.

// Cleanup some old tldraw non-yjs persistence functions
process.on('SIGTERM', () => { process.exit(0); });
process.on('SIGINT',  () => { process.exit(0); });

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
});
