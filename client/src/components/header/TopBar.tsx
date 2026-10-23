import React from 'react';
import { 
  Sparkles, 
  Share2, 
  Download, 
  Sun, 
  Moon, 
  Check, 
  Github 
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
    setIsShareModalOpen 
  } = useCanvasStore();

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 6px', color: '#10b981', fontSize: '11px', fontWeight: 600 }}>
          <Check size={12} />
          <span>Saved</span>
        </div>
      </div>

      {/* Collaborator & Actions */}
      <div className="top-bar-interactive glass-panel" style={{ padding: '4px 8px' }}>
        {/* User Avatar Badge */}
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
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="dock-tool-btn"
          style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Free & Open Source on GitHub"
        >
          <Github size={16} />
        </a>
      </div>
    </header>
  );
};
