import React from 'react';
import { 
  Sparkles, 
  Share2, 
  Download, 
  Sun, 
  Moon, 
  Users, 
  Github,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';

interface TopBarProps {
  onExport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onExport }) => {
  const { 
    boardTitle, 
    setBoardTitle, 
    theme, 
    toggleTheme, 
    nickname, 
    userColor,
    collaborators,
    mySocketId,
    isConnected,
    setIsShareModalOpen 
  } = useCanvasStore();

  const otherCollaborators = Object.values(collaborators).filter(
    (c) => c.socketId !== mySocketId
  );

  return (
    <header className="top-bar">
      {/* Brand & Board Title */}
      <div className="top-bar-interactive glass-panel" style={{ padding: '4px 8px' }}>
        <div className="brand-badge">
          <div className="brand-icon-wrapper">
            <Sparkles size={15} />
          </div>
          <span>CollabSpace</span>
        </div>

        <div className="dock-divider" style={{ height: '20px' }} />

        <input
          type="text"
          className="board-title-input"
          value={boardTitle}
          onChange={(e) => setBoardTitle(e.target.value)}
          title="Click to rename board"
        />

        {/* Live Multiplayer Status Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '2px 8px',
            borderRadius: '12px',
            background: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: isConnected ? '#10b981' : '#ef4444',
            fontSize: '11px',
            fontWeight: 600,
          }}
          title={isConnected ? 'Connected to real-time sync server' : 'Disconnected from server'}
        >
          {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{isConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* Collaborator Avatars & Actions */}
      <div className="top-bar-interactive glass-panel" style={{ padding: '4px 8px' }}>
        {/* Remote Collaborator Avatars */}
        {otherCollaborators.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', marginRight: '4px', gap: '-6px' }}>
            {otherCollaborators.slice(0, 3).map((collab) => (
              <div
                key={collab.socketId}
                title={`${collab.nickname} is collaborating`}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: collab.color || '#8b5cf6',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-surface-solid)',
                  marginLeft: '-6px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}
              >
                {collab.nickname.charAt(0).toUpperCase()}
              </div>
            ))}
            {otherCollaborators.length > 3 && (
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-hover)',
                  color: 'var(--text-secondary)',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-surface-solid)',
                  marginLeft: '-6px',
                }}
              >
                +{otherCollaborators.length - 3}
              </div>
            )}
          </div>
        )}

        {/* Current User Avatar Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: 600 }}>
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: userColor,
              border: '2px solid rgba(255,255,255,0.4)',
            }}
          />
          <span style={{ color: 'var(--text-secondary)' }}>{nickname}</span>
        </div>

        <div className="dock-divider" style={{ height: '20px' }} />

        {/* Share Button */}
        <button
          type="button"
          className="dock-tool-btn"
          style={{ width: 'auto', padding: '0 12px', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--accent-light)' }}
          onClick={() => setIsShareModalOpen(true)}
        >
          <Share2 size={15} />
          <span>Share</span>
          {otherCollaborators.length > 0 && (
            <span
              style={{
                background: 'var(--accent-primary)',
                color: '#fff',
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '10px',
                marginLeft: '2px',
              }}
            >
              {otherCollaborators.length + 1}
            </span>
          )}
        </button>

        {/* Export High-Res PNG Button */}
        <button
          type="button"
          className="dock-tool-btn"
          style={{ width: '34px', height: '34px' }}
          onClick={onExport}
          title="Export as 2x Retina PNG"
        >
          <Download size={16} />
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          className="dock-tool-btn"
          style={{ width: '34px', height: '34px' }}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Open Source / GitHub */}
        <a
          href="https://github.com/Vaibhav-0077/CollabSpace-"
          target="_blank"
          rel="noopener noreferrer"
          className="dock-tool-btn"
          style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="CollabSpace on GitHub"
        >
          <Github size={16} />
        </a>
      </div>
    </header>
  );
};
