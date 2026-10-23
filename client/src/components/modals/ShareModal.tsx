import React, { useState } from 'react';
import { X, Copy, Check, Users, Shield } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';

export const ShareModal: React.FC = () => {
  const { 
    isShareModalOpen, 
    setIsShareModalOpen, 
    boardId, 
    nickname, 
    setNickname 
  } = useCanvasStore();

  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/b/${boardId}`;

  if (!isShareModalOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={() => setIsShareModalOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--bg-active)', color: 'var(--accent-light)' }}>
              <Users size={18} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Share Board</h3>
          </div>
          <button
            type="button"
            className="dock-tool-btn"
            style={{ width: '28px', height: '28px' }}
            onClick={() => setIsShareModalOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Info Banner */}
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <Shield size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
          <span><strong>Zero-Login Collaboration:</strong> Anyone with this link can join, draw, and brainstorm with you in real time.</span>
        </div>

        {/* Link Input & Copy Button */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            Board Invite Link
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              readOnly
              value={shareUrl}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="button"
              onClick={handleCopy}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: copied ? '#10b981' : 'var(--accent-primary)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '13px',
                gap: '6px',
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Nickname Editor */}
        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            Your Display Nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Alex"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              fontSize: '13px',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>
    </div>
  );
};
