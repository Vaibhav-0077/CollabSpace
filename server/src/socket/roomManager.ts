import { RoomState, UserPresence, EphemeralLock, CanvasObjectData } from '../types.js';

class RoomManager {
  private rooms: Map<string, RoomState> = new Map();
  // Map of socketId -> roomId
  private socketToRoom: Map<string, string> = new Map();

  public getOrCreateRoom(roomId: string): RoomState {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        users: {},
        locks: {},
        objects: {},
        seqId: 0,
      };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  public joinUser(
    roomId: string,
    socketId: string,
    nickname: string,
    color: string
  ): { room: RoomState; user: UserPresence } {
    const room = this.getOrCreateRoom(roomId);
    const user: UserPresence = {
      socketId,
      nickname,
      color,
      x: 0,
      y: 0,
      lastActive: Date.now(),
    };

    room.users[socketId] = user;
    this.socketToRoom.set(socketId, roomId);

    return { room, user };
  }

  public removeUser(socketId: string): { roomId: string; releasedLocks: string[] } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(roomId);
    if (!room) return null;

    delete room.users[socketId];

    // Release any locks held by this disconnected user
    const releasedLocks: string[] = [];
    for (const [objId, lock] of Object.entries(room.locks)) {
      if (lock.socketId === socketId) {
        delete room.locks[objId];
        releasedLocks.push(objId);
      }
    }

    // Clean up empty rooms after 1 hour if needed, or keep in memory
    if (Object.keys(room.users).length === 0) {
      room.locks = {};
    }

    return { roomId, releasedLocks };
  }

  public updateCursor(socketId: string, x: number, y: number): { roomId: string } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (room && room.users[socketId]) {
      room.users[socketId].x = x;
      room.users[socketId].y = y;
      room.users[socketId].lastActive = Date.now();
      return { roomId };
    }
    return null;
  }

  public acquireLock(
    socketId: string,
    objectId: string
  ): { success: boolean; lock?: EphemeralLock; roomId?: string } {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return { success: false };

    const room = this.rooms.get(roomId);
    if (!room) return { success: false };

    const existingLock = room.locks[objectId];
    const now = Date.now();

    // Check if existing lock is active and owned by someone else
    if (existingLock && existingLock.expiresAt > now && existingLock.socketId !== socketId) {
      return { success: false };
    }

    const user = room.users[socketId];
    if (!user) return { success: false };

    const lock: EphemeralLock = {
      objectId,
      socketId,
      nickname: user.nickname,
      color: user.color,
      expiresAt: now + 5000, // 5-second TTL
    };

    room.locks[objectId] = lock;
    return { success: true, lock, roomId };
  }

  public releaseLock(socketId: string, objectId: string): { roomId: string } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    const lock = room.locks[objectId];
    if (lock && lock.socketId === socketId) {
      delete room.locks[objectId];
      return { roomId };
    }

    return null;
  }

  public saveObject(socketId: string, objectData: CanvasObjectData): { roomId: string; seqId: number } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room || !objectData.id) return null;

    room.seqId += 1;
    room.objects[objectData.id] = objectData;
    return { roomId, seqId: room.seqId };
  }

  public deleteObject(socketId: string, objectId: string): { roomId: string; seqId: number } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.seqId += 1;
    delete room.objects[objectId];
    delete room.locks[objectId];
    return { roomId, seqId: room.seqId };
  }

  public clearCanvas(socketId: string): { roomId: string } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.seqId += 1;
    room.objects = {};
    room.locks = {};
    return { roomId };
  }

  public getRoomIdForSocket(socketId: string): string | undefined {
    return this.socketToRoom.get(socketId);
  }
}

export const roomManager = new RoomManager();
