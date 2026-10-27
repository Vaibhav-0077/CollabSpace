import React from 'react';
import { Sparkles, MousePointer2, StickyNote, Share2 } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';

export const QuickStartCard: React.FC = () => {
  const hasObjects = useCanvasStore((state) => state.hasObjects);

  if (hasObjects) return null;

  return (
    <div className="quick-start-card glass-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
        <Sparkles size={20} style={{ color: '#818cf8' }} />
        <h2 className="quick-start-title">Welcome to CollabSpace</h2>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Your infinite collaborative canvas. Zero login required.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', background: 'var(--bg-hover)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
        <div className="quick-start-step">
          <MousePointer2 size={15} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
          <span><strong>1. Click a shape</strong> or tool on the top dock above</span>
        </div>
        <div className="quick-start-step">
          <StickyNote size={15} style={{ color: '#fef08a', flexShrink: 0 }} />
          <span><strong>2. Double-click</strong> or press <kbd style={{ padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-surface-solid)', fontSize: '11px' }}>S</kbd> to add sticky notes</span>
        </div>
        <div className="quick-start-step">
          <Share2 size={15} style={{ color: '#10b981', flexShrink: 0 }} />
          <span><strong>3. Copy link</strong> from top bar to invite anyone in real time</span>
        </div>
      </div>
    </div>
  );
};
