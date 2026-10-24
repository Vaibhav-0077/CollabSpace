import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { ToolType, SelectedObjectState } from '../types/canvas';

const RANDOM_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export interface CollaboratorInfo {
  socketId: string;
  nickname: string;
  color: string;
  x: number;
  y: number;
}

export interface RemoteLockInfo {
  objectId: string;
  socketId: string;
  nickname: string;
  color: string;
}

interface CanvasStoreState {
  activeTool: ToolType;
  selectedFill: string;
  selectedStroke: string;
  strokeWidth: number;
  zoom: number;
  theme: 'dark' | 'light';
  boardTitle: string;
  boardId: string;
  nickname: string;
  userColor: string;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  hasObjects: boolean;
  isShareModalOpen: boolean;
  isExportModalOpen: boolean;
  isAIModalOpen: boolean;
  selectedObject: SelectedObjectState | null;

  // Real-Time Multiplayer State
  isConnected: boolean;
  mySocketId: string | null;
  collaborators: Record<string, CollaboratorInfo>;
  remoteLocks: Record<string, RemoteLockInfo>;

  // Actions
  setActiveTool: (tool: ToolType) => void;
  setSelectedFill: (fill: string) => void;
  setSelectedStroke: (stroke: string) => void;
  setStrokeWidth: (width: number) => void;
  setZoom: (zoom: number) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setBoardTitle: (title: string) => void;
  setBoardId: (id: string) => void;
  setNickname: (name: string) => void;
  setUndoRedoState: (canUndo: boolean, canRedo: boolean) => void;
  toggleGrid: () => void;
  setHasObjects: (has: boolean) => void;
  setIsShareModalOpen: (open: boolean) => void;
  setIsExportModalOpen: (open: boolean) => void;
  setIsAIModalOpen: (open: boolean) => void;
  setSelectedObject: (obj: SelectedObjectState | null) => void;

  // Real-time Actions
  setIsConnected: (connected: boolean) => void;
  setMySocketId: (id: string | null) => void;
  setCollaborators: (users: Record<string, CollaboratorInfo>) => void;
  addCollaborator: (user: CollaboratorInfo) => void;
  removeCollaborator: (socketId: string) => void;
  updateCollaboratorCursor: (socketId: string, x: number, y: number) => void;
  setRemoteLock: (lock: RemoteLockInfo) => void;
  removeRemoteLock: (objectId: string) => void;
}

export const useCanvasStore = create<CanvasStoreState>((set) => {
  // Check URL or localStorage for room ID
  const pathParts = window.location.pathname.split('/');
  const existingBoardId = pathParts[1] === 'b' && pathParts[2] ? pathParts[2] : nanoid(12);
  
  const savedName = localStorage.getItem('collabspace_nickname') || `Guest ${Math.floor(100 + Math.random() * 900)}`;
  const savedColor = localStorage.getItem('collabspace_color') || RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
  const savedTheme = (localStorage.getItem('collabspace_theme') as 'dark' | 'light') || 'dark';

  return {
    activeTool: 'select',
    selectedFill: '#fef08a',
    selectedStroke: '#6366f1',
    strokeWidth: 2,
    zoom: 1.0,
    theme: savedTheme,
    boardTitle: 'Architecture Ideation',
    boardId: existingBoardId,
    nickname: savedName,
    userColor: savedColor,
    canUndo: false,
    canRedo: false,
    showGrid: true,
    hasObjects: false,
    isShareModalOpen: false,
    isExportModalOpen: false,
    isAIModalOpen: false,
    selectedObject: null,

    // Real-time state
    isConnected: false,
    mySocketId: null,
    collaborators: {},
    remoteLocks: {},

    setActiveTool: (activeTool) => set({ activeTool }),
    setSelectedFill: (selectedFill) => set({ selectedFill }),
    setSelectedStroke: (selectedStroke) => set({ selectedStroke }),
    setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
    setZoom: (zoom) => set({ zoom }),
    setTheme: (theme) => {
      localStorage.setItem('collabspace_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      set({ theme });
    },
    toggleTheme: () => set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('collabspace_theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      return { theme: nextTheme };
    }),
    setBoardTitle: (boardTitle) => set({ boardTitle }),
    setBoardId: (boardId) => set({ boardId }),
    setNickname: (nickname) => {
      localStorage.setItem('collabspace_nickname', nickname);
      set({ nickname });
    },
    setUndoRedoState: (canUndo, canRedo) => set({ canUndo, canRedo }),
    toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
    setHasObjects: (hasObjects) => set({ hasObjects }),
    setIsShareModalOpen: (isShareModalOpen) => set({ isShareModalOpen }),
    setIsExportModalOpen: (isExportModalOpen) => set({ isExportModalOpen }),
    setIsAIModalOpen: (isAIModalOpen) => set({ isAIModalOpen }),
    setSelectedObject: (selectedObject) => set({ selectedObject }),

    // Real-time actions
    setIsConnected: (isConnected) => set({ isConnected }),
    setMySocketId: (mySocketId) => set({ mySocketId }),
    setCollaborators: (collaborators) => set({ collaborators }),
    addCollaborator: (user) => set((state) => ({
      collaborators: { ...state.collaborators, [user.socketId]: user },
    })),
    removeCollaborator: (socketId) => set((state) => {
      const updated = { ...state.collaborators };
      delete updated[socketId];
      return { collaborators: updated };
    }),
    updateCollaboratorCursor: (socketId, x, y) => set((state) => {
      const user = state.collaborators[socketId];
      if (!user) return state;
      return {
        collaborators: {
          ...state.collaborators,
          [socketId]: { ...user, x, y },
        },
      };
    }),
    setRemoteLock: (lock) => set((state) => ({
      remoteLocks: { ...state.remoteLocks, [lock.objectId]: lock },
    })),
    removeRemoteLock: (objectId) => set((state) => {
      const updated = { ...state.remoteLocks };
      delete updated[objectId];
      return { remoteLocks: updated };
    }),
  };
});
