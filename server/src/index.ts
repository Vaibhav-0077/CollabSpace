import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { roomManager } from './socket/roomManager.js';
import { ClientToServerEvents, ServerToClientEvents } from './types.js';

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Enable CORS for frontend clients
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'CollabSpace Real-Time Server', time: new Date().toISOString() });
});

// REST endpoint to get room state snapshot
app.get('/api/rooms/:roomId', (req, res) => {
  const room = roomManager.getOrCreateRoom(req.params.roomId);
  res.json({
    roomId: room.roomId,
    activeUserCount: Object.keys(room.users).length,
    objectCount: Object.keys(room.objects).length,
    seqId: room.seqId,
  });
});

// Initialize Socket.IO with CORS
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  // Join Room
  socket.on('join_room', ({ roomId, nickname, color }) => {
    socket.join(roomId);
    const { room, user } = roomManager.joinUser(roomId, socket.id, nickname, color);

    // Send complete current room state to joining client
    socket.emit('room_init', {
      room,
      yourSocketId: socket.id,
    });

    // Notify other members of room about new user
    socket.to(roomId).emit('user_joined', user);
  });

  // Cursor Move (High-frequency, broadcasted in world coordinates)
  socket.on('cursor_move', ({ x, y }) => {
    const result = roomManager.updateCursor(socket.id, x, y);
    if (result) {
      socket.to(result.roomId).emit('cursor_update', {
        socketId: socket.id,
        x,
        y,
      });
    }
  });

  // Ephemeral Object Lock (Prevents dual-user drag conflicts)
  socket.on('object_lock', ({ objectId }) => {
    const result = roomManager.acquireLock(socket.id, objectId);
    if (result.success && result.lock && result.roomId) {
      io.to(result.roomId).emit('object_locked', result.lock);
    }
  });

  // Release Object Lock
  socket.on('object_unlock', ({ objectId }) => {
    const result = roomManager.releaseLock(socket.id, objectId);
    if (result) {
      io.to(result.roomId).emit('object_unlocked', { objectId });
    }
  });

  // Object Transforming (Streamed during active drag)
  socket.on('object_transforming', (data) => {
    const roomId = roomManager.getRoomIdForSocket(socket.id);
    if (roomId) {
      socket.to(roomId).emit('object_transforming', data);
    }
  });

  // Object Modified (Committed on mouseup)
  socket.on('object_modified', ({ object }) => {
    const result = roomManager.saveObject(socket.id, object);
    if (result) {
      socket.to(result.roomId).emit('object_modified', {
        object,
        seqId: result.seqId,
      });
    }
  });

  // Object Added
  socket.on('object_added', ({ object }) => {
    const result = roomManager.saveObject(socket.id, object);
    if (result) {
      socket.to(result.roomId).emit('object_added', {
        object,
        seqId: result.seqId,
      });
    }
  });

  // Object Removed
  socket.on('object_removed', ({ id }) => {
    const result = roomManager.deleteObject(socket.id, id);
    if (result) {
      socket.to(result.roomId).emit('object_removed', {
        id,
        seqId: result.seqId,
      });
    }
  });

  // Clear Canvas
  socket.on('canvas_clear', () => {
    const result = roomManager.clearCanvas(socket.id);
    if (result) {
      socket.to(result.roomId).emit('canvas_cleared');
    }
  });

  // Disconnection cleanup
  socket.on('disconnect', () => {
    const result = roomManager.removeUser(socket.id);
    if (result) {
      // Notify room about user leaving
      socket.to(result.roomId).emit('user_left', { socketId: socket.id });

      // Unlock any objects left locked by this user
      for (const objectId of result.releasedLocks) {
        socket.to(result.roomId).emit('object_unlocked', { objectId });
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 CollabSpace Real-Time Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint ready for rooms`);
});
