export interface UserPresence {
  socketId: string;
  nickname: string;
  color: string;
  x: number;
  y: number;
  lastActive: number;
}

export interface EphemeralLock {
  objectId: string;
  socketId: string;
  nickname: string;
  color: string;
  expiresAt: number;
}

export interface CanvasObjectData {
  id: string;
  [key: string]: any;
}

export interface RoomState {
  roomId: string;
  users: Record<string, UserPresence>;
  locks: Record<string, EphemeralLock>;
  objects: Record<string, CanvasObjectData>;
  seqId: number;
}

export interface ClientToServerEvents {
  join_room: (data: { roomId: string; nickname: string; color: string }) => void;
  cursor_move: (data: { x: number; y: number }) => void;
  laser_pointer: (data: { x: number; y: number; color: string }) => void;
  viewport_move: (data: { sceneCenterX: number; sceneCenterY: number; zoom: number }) => void;
  object_lock: (data: { objectId: string }) => void;
  object_unlock: (data: { objectId: string }) => void;
  object_transforming: (data: { id: string; left: number; top: number; scaleX?: number; scaleY?: number; angle?: number }) => void;
  object_modified: (data: { object: CanvasObjectData }) => void;
  object_added: (data: { object: CanvasObjectData }) => void;
  object_removed: (data: { id: string }) => void;
  canvas_clear: () => void;
}

export interface ServerToClientEvents {
  room_init: (data: {
    room: RoomState;
    yourSocketId: string;
  }) => void;
  user_joined: (user: UserPresence) => void;
  user_left: (data: { socketId: string }) => void;
  cursor_update: (data: { socketId: string; x: number; y: number }) => void;
  laser_pointer: (data: { socketId: string; x: number; y: number; color: string }) => void;
  user_viewport: (data: { socketId: string; sceneCenterX: number; sceneCenterY: number; zoom: number }) => void;
  object_locked: (lock: EphemeralLock) => void;
  object_unlocked: (data: { objectId: string }) => void;
  object_transforming: (data: { id: string; left: number; top: number; scaleX?: number; scaleY?: number; angle?: number }) => void;
  object_modified: (data: { object: CanvasObjectData; seqId: number }) => void;
  object_added: (data: { object: CanvasObjectData; seqId: number }) => void;
  object_removed: (data: { id: string; seqId: number }) => void;
  canvas_cleared: () => void;
}
