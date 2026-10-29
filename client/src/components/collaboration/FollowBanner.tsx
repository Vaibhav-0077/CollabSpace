import React from 'react';
import { Eye, X } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';

interface FollowBannerProps {
  onStop?: () => void;
}

export const FollowBanner: React.FC<FollowBannerProps> = ({ onStop }) => {
  const followingSocketId = useCanvasStore((state) => state.followingSocketId);
  const setFollowingSocketId = useCanvasStore((state) => state.setFollowingSocketId);
  const collaborators = useCanvasStore((state) => state.collaborators);

  if (!followingSocketId) return null;

  const targetUser = collaborators[followingSocketId];
  const userName = targetUser ? targetUser.nickname : 'Collaborator';
  const userColor = targetUser?.color || '#ec4899';

  const handleStop = () => {
    if (onStop) {
      onStop();
    } else {
      setFollowingSocketId(null);
    }
  };

  return (
    <div className="follow-banner glass-panel">
      <div className="follow-banner-user">
        <div 
          className="follow-avatar-bubble"
          style={{ backgroundColor: userColor }}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
        
        <div className="follow-banner-info">
          <div className="follow-banner-heading">
            <Eye size={14} className="follow-eye-icon" />
            <span>Following <strong>{userName}</strong></span>
          </div>
          <span className="follow-banner-subtitle">Camera locked to presenter • Move canvas or press <kbd>Esc</kbd> to exit</span>
        </div>
      </div>

      <button
        type="button"
        className="follow-stop-btn"
        onClick={handleStop}
        title="Stop following (Esc)"
      >
        <X size={14} />
        <span>Stop</span>
      </button>
    </div>
  );
};

