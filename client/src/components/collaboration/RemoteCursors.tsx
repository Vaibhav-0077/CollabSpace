import React from 'react';
import { useCanvasStore } from '../../store/canvasStore';

interface RemoteCursorsProps {
  canvasVpt: number[]; // [scaleX, skewY, skewX, scaleY, transX, transY]
  zoom: number;
}

export const RemoteCursors: React.FC<RemoteCursorsProps> = ({ canvasVpt, zoom }) => {
  const collaborators = useCanvasStore((state) => state.collaborators);
  const mySocketId = useCanvasStore((state) => state.mySocketId);

  const transX = canvasVpt ? canvasVpt[4] : 0;
  const transY = canvasVpt ? canvasVpt[5] : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 15,
        overflow: 'hidden',
      }}
    >
      {Object.values(collaborators)
        .filter((user) => user.socketId !== mySocketId)
        .map((user) => {
          // Convert world coords to screen viewport coords
          const screenX = user.x * zoom + transX;
          const screenY = user.y * zoom + transY;

          return (
            <div
              key={user.socketId}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
                transition: 'transform 0.08s cubic-bezier(0, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                pointerEvents: 'none',
              }}
            >
              {/* Custom SVG Cursor Arrow */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                }}
              >
                <path
                  d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                  fill={user.color || '#6366f1'}
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />
              </svg>

              {/* User Nickname Tag */}
              <div
                style={{
                  marginLeft: '12px',
                  marginTop: '-4px',
                  backgroundColor: user.color || '#6366f1',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.4)',
                }}
              >
                {user.nickname}
              </div>
            </div>
          );
        })}
    </div>
  );
};
