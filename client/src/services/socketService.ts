import { io, type Socket } from 'socket.io-client';
import { useCanvasStore } from '../store/canvasStore';

class SocketService {
  private socket: Socket | null = null;
  private backendUrl = (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:3001';

  // Callbacks for Canvas mutation updates
  public onRemoteObjectAdded?: (object: any) => void;
  public onRemoteObjectModified?: (object: any) => void;
  public onRemoteObjectTransforming?: (data: { id: string; left: number; top: number; scaleX?: number; scaleY?: number; angle?: number }) => void;
  public onRemoteObjectRemoved?: (id: string) => void;
  public onRemoteCanvasCleared?: () => void;
  public onRoomInitialized?: (objects: Record<string, any>) => void;
  public onLaserPointer?: (data: { socketId: string; x: number; y: number; color: string }) => void;
  public onUserViewport?: (data: { socketId: string; sceneCenterX: number; sceneCenterY: number; zoom: number }) => void;

  public connect(roomId: string, nickname: string, color: string) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    const store = useCanvasStore.getState();

    this.socket.on('connect', () => {
      console.log('⚡ Connected to CollabSpace Socket Server:', this.socket?.id);
      store.setIsConnected(true);
      store.setMySocketId(this.socket?.id || null);

      this.socket?.emit('join_room', {
        roomId,
        nickname,
        color,
      });
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from CollabSpace server');
      store.setIsConnected(false);
      store.setMySocketId(null);
    });

    // Room Initialization: receive current active members and objects
    this.socket.on('room_init', (data: { room: any; yourSocketId: string }) => {
      store.setCollaborators(data.room.users);
      if (data.room.locks) {
        for (const lock of Object.values(data.room.locks) as any[]) {
          store.setRemoteLock(lock);
        }
      }
      if (this.onRoomInitialized && data.room.objects) {
        this.onRoomInitialized(data.room.objects);
      }
    });

    // User joined
    this.socket.on('user_joined', (user: any) => {
      store.addCollaborator(user);
    });

    // User left
    this.socket.on('user_left', ({ socketId }: { socketId: string }) => {
      store.removeCollaborator(socketId);
    });

    // Remote Cursor update
    this.socket.on('cursor_update', ({ socketId, x, y }: { socketId: string; x: number; y: number }) => {
      store.updateCollaboratorCursor(socketId, x, y);
    });

    // Ephemeral object locked
    this.socket.on('object_locked', (lock: any) => {
      store.setRemoteLock(lock);
    });

    // Object unlocked
    this.socket.on('object_unlocked', ({ objectId }: { objectId: string }) => {
      store.removeRemoteLock(objectId);
    });

    // Remote object transforming during drag
    this.socket.on('object_transforming', (data: any) => {
      if (this.onRemoteObjectTransforming) {
        this.onRemoteObjectTransforming(data);
      }
    });

    // Remote object modified (committed)
    this.socket.on('object_modified', ({ object }: { object: any }) => {
      if (this.onRemoteObjectModified) {
        this.onRemoteObjectModified(object);
      }
    });

    // Remote object added
    this.socket.on('object_added', ({ object }: { object: any }) => {
      if (this.onRemoteObjectAdded) {
        this.onRemoteObjectAdded(object);
      }
    });

    // Remote object removed
    this.socket.on('object_removed', ({ id }: { id: string }) => {
      if (this.onRemoteObjectRemoved) {
        this.onRemoteObjectRemoved(id);
      }
    });

    // Canvas cleared
    this.socket.on('canvas_cleared', () => {
      if (this.onRemoteCanvasCleared) {
        this.onRemoteCanvasCleared();
      }
    });

    // Remote Laser pointer
    this.socket.on('laser_pointer', (data: { socketId: string; x: number; y: number; color: string }) => {
      if (this.onLaserPointer) {
        this.onLaserPointer(data);
      }
    });

    // Remote User Viewport (Follow Me mode)
    this.socket.on('user_viewport', (data: { socketId: string; sceneCenterX: number; sceneCenterY: number; zoom: number }) => {
      if (this.onUserViewport) {
        this.onUserViewport(data);
      }
    });
  }

  public emitCursorMove(x: number, y: number) {
    this.socket?.emit('cursor_move', { x, y });
  }

  public emitLaserPointer(x: number, y: number, color: string) {
    this.socket?.emit('laser_pointer', { x, y, color });
  }

  public emitViewportMove(sceneCenterX: number, sceneCenterY: number, zoom: number) {
    this.socket?.emit('viewport_move', { sceneCenterX, sceneCenterY, zoom });
  }

  public emitObjectLock(objectId: string) {
    this.socket?.emit('object_lock', { objectId });
  }

  public emitObjectUnlock(objectId: string) {
    this.socket?.emit('object_unlock', { objectId });
  }

  public emitObjectTransforming(data: { id: string; left: number; top: number; scaleX?: number; scaleY?: number; angle?: number }) {
    this.socket?.emit('object_transforming', data);
  }

  public emitObjectModified(object: any) {
    this.socket?.emit('object_modified', { object });
  }

  public emitObjectAdded(object: any) {
    this.socket?.emit('object_added', { object });
  }

  public emitObjectRemoved(id: string) {
    this.socket?.emit('object_removed', { id });
  }

  public emitCanvasClear() {
    this.socket?.emit('canvas_clear');
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
