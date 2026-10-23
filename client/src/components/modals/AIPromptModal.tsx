import React, { useState } from 'react';
import { Sparkles, X, ArrowRight, Wand2 } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';

interface AIPromptModalProps {
  onGenerateDiagram: (prompt: string) => void;
}

const PRESET_EXAMPLES = [
  'Microservice Auth Flow (Client -> Gateway -> Auth Service -> PostgreSQL DB)',
  'User Onboarding Decision Tree (Sign Up -> Verified? -> Dashboard : Resend Email)',
  'Kanban Board with Columns: Backlog, In Progress, Review, Completed',
  'E-Commerce Order Pipeline (Cart -> Checkout -> Payment -> Fulfillment)',
];

export const AIPromptModal: React.FC<AIPromptModalProps> = ({ onGenerateDiagram }) => {
  const { isAIModalOpen, setIsAIModalOpen } = useCanvasStore();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isAIModalOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setTimeout(() => {
      onGenerateDiagram(prompt);
      setIsGenerating(false);
      setIsAIModalOpen(false);
      setPrompt('');
    }, 600);
  };

  return (
    <div className="modal-overlay" onClick={() => setIsAIModalOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc' }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>AI Diagram Generator</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generate structured flowcharts & architectures from natural language</p>
            </div>
          </div>
          <button
            type="button"
            className="dock-tool-btn"
            style={{ width: '28px', height: '28px' }}
            onClick={() => setIsAIModalOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your diagram or flowchart (e.g. 'Authentication flow between React, Express API, and Redis cache')..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-medium)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                resize: 'none',
              }}
              autoFocus
            />
          </div>

          {/* Quick Preset Pills */}
          <div style={{ marginBottom: '18px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Suggested Examples:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {PRESET_EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                    textAlign: 'left',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex}</span>
                  <ArrowRight size={12} style={{ opacity: 0.5, flexShrink: 0, marginLeft: '6px' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="dock-tool-btn"
              style={{ width: 'auto', padding: '8px 14px', borderRadius: '8px', fontSize: '13px' }}
              onClick={() => setIsAIModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '13px',
                gap: '6px',
                boxShadow: '0 4px 14px var(--accent-glow)',
                opacity: isGenerating || !prompt.trim() ? 0.6 : 1,
              }}
            >
              <Wand2 size={15} />
              <span>{isGenerating ? 'Generating...' : 'Generate Diagram'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
