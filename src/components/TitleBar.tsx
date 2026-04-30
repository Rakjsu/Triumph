import { Minus, Square, Trophy, X } from "lucide-react";

interface WindowHandle {
  minimize: () => Promise<void>;
}

interface TitleBarProps {
  appWindow: WindowHandle;
  onMaximize: () => void;
  onClose: () => void;
}

export function TitleBar({ appWindow, onMaximize, onClose }: TitleBarProps) {
  return (
    <div className="titlebar">
      <div className="titlebar-content" data-tauri-drag-region style={{flex: 1, pointerEvents: "auto", height: "100%", cursor: "default"}}>
        <Trophy size={16} color="var(--accent-cyan)" style={{pointerEvents: "none"}} />
        <span style={{pointerEvents: "none"}}>Triumph Nexus</span>
      </div>
      <div className="titlebar-controls" style={{zIndex: 10, position: "relative"}}>
        <button className="titlebar-button" onClick={() => appWindow.minimize()}>
          <Minus size={16} />
        </button>
        <button className="titlebar-button" onClick={onMaximize}>
          <Square size={14} />
        </button>
        <button className="titlebar-button close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
