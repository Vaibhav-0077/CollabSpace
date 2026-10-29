import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Share2, 
  Download, 
  Sun, 
  Moon,
  FileImage,
  FileCode,
  Copy,
  Check,
  Eye
} from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';

interface TopBarProps {
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportJSON: () => void;
  onCopyImage: () => Promise<boolean>;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  onExportPNG,
  onExportSVG,
  onExportJSON,
  onCopyImage,
}) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportMenuOpen]);

  const handleCopy = async () => {
    const success = await onCopyImage();
    if (success) {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2000);
    }
  };

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
    setIsShareModalOpen,
    followingSocketId,
    setFollowingSocketId
  } = useCanvasStore();

  const otherCollaborators = Object.values(collaborators).filter(
    (c) => c.socketId !== mySocketId
  );

  return (
    <header className="top-bar">
      {/* Brand & Board Title */}
      <div className="top-bar-interactive glass-panel" style={{ padding: '3px 8px' }}>
        <div className="brand-badge">
          <div className="brand-icon-wrapper">
            <Sparkles size={14} />
          </div>
          <span className="brand-text">CollabSpace</span>
        </div>

        <div className="dock-divider" style={{ height: '16px' }} />

        <input
          type="text"
          className="board-title-input"
          value={boardTitle}
          onChange={(e) => setBoardTitle(e.target.value)}
          title="Click to rename board"
        />

        {/* Live Multiplayer Status Indicator */}
        <div
          className="live-status-pill"
          style={{
            background: isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: isConnected ? '#10b981' : '#ef4444',
          }}
          title={isConnected ? 'Connected to real-time sync server' : 'Disconnected from server'}
        >
          <span className={`status-dot ${isConnected ? 'live' : 'offline'}`} />
          <span className="live-status-label">{isConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* Collaborator Avatars & Actions */}
      <div className="top-bar-interactive glass-panel" style={{ padding: '4px 8px' }}>
        {/* Remote Collaborator Avatars */}
        {otherCollaborators.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', marginRight: '4px', gap: '-6px' }}>
            {otherCollaborators.slice(0, 4).map((collab) => {
              const isFollowing = followingSocketId === collab.socketId;
              return (
                <button
                  type="button"
                  key={collab.socketId}
                  onClick={() => {
                    if (isFollowing) {
                      setFollowingSocketId(null);
                    } else {
                      setFollowingSocketId(collab.socketId);
                    }
                  }}
                  className={`collab-avatar-btn ${isFollowing ? 'is-following' : ''}`}
                  title={isFollowing ? `Stop following ${collab.nickname}` : `Click to follow ${collab.nickname}'s view`}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: collab.color || '#8b5cf6',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: isFollowing ? '2px solid #ec4899' : '2px solid var(--bg-surface-solid)',
                    marginLeft: '-6px',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: 0,
                    outline: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {collab.nickname.charAt(0).toUpperCase()}
                  {isFollowing && (
                    <span 
                      style={{
                        position: 'absolute',
                        bottom: '-3px',
                        right: '-3px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#ec4899',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #ffffff',
                      }}
                    >
                      <Eye size={7} color="#ffffff" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
            {otherCollaborators.length > 4 && (
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
                +{otherCollaborators.length - 4}
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

        {/* Export & Share Dropdown Menu */}
        <div style={{ position: 'relative' }} ref={exportMenuRef}>
          <button
            type="button"
            className={`dock-tool-btn ${isExportMenuOpen ? 'active' : ''}`}
            style={{ width: '34px', height: '34px' }}
            onClick={() => setIsExportMenuOpen((prev) => !prev)}
            title="Export & Download Canvas"
          >
            <Download size={16} />
          </button>

          {isExportMenuOpen && (
            <div className="export-dropdown-menu glass-panel">
              <div className="export-menu-header">Export Canvas</div>

              <button
                type="button"
                className="export-menu-item"
                onClick={() => {
                  onExportPNG();
                  setIsExportMenuOpen(false);
                }}
              >
                <FileImage size={15} style={{ color: '#818cf8', flexShrink: 0 }} />
                <div className="export-item-text">
                  <span className="export-item-title">PNG Image</span>
                  <span className="export-item-desc">2x Retina raster (standard)</span>
                </div>
              </button>

              <button
                type="button"
                className="export-menu-item"
                onClick={() => {
                  onExportSVG();
                  setIsExportMenuOpen(false);
                }}
              >
                <FileCode size={15} style={{ color: '#38bdf8', flexShrink: 0 }} />
                <div className="export-item-text">
                  <span className="export-item-title">Vector SVG</span>
                  <span className="export-item-desc">Infinite zoom vector graphic</span>
                </div>
              </button>

              <button
                type="button"
                className="export-menu-item"
                onClick={handleCopy}
              >
                {copiedSuccess ? (
                  <Check size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                ) : (
                  <Copy size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                )}
                <div className="export-item-text">
                  <span className="export-item-title">
                    {copiedSuccess ? 'Copied to Clipboard!' : 'Copy to Clipboard'}
                  </span>
                  <span className="export-item-desc">Paste directly into docs & chat</span>
                </div>
              </button>

              <div className="export-menu-divider" />

              <button
                type="button"
                className="export-menu-item"
                onClick={() => {
                  onExportJSON();
                  setIsExportMenuOpen(false);
                }}
              >
                <Download size={15} style={{ color: '#ec4899', flexShrink: 0 }} />
                <div className="export-item-text">
                  <span className="export-item-title">Project JSON</span>
                  <span className="export-item-desc">Lossless editable board backup</span>
                </div>
              </button>
            </div>
          )}
        </div>

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
          href="https://github.com/Vaibhav-0077/CollabSpace"
          target="_blank"
          rel="noopener noreferrer"
          className="dock-tool-btn"
          style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="CollabSpace on GitHub"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        </a>
      </div>
    </header>
  );
};
