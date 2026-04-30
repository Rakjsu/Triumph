import { RefreshCw, Settings, Terminal, Trophy } from "lucide-react";
import type { AppView, UpdateInfo } from "../types";

interface AppHeaderProps {
  colorData: string | null;
  updateAvailable: UpdateInfo | null;
  view: AppView;
  setView: (view: AppView) => void;
  onRescan: () => void;
}

export function AppHeader({ colorData, updateAvailable, view, setView, onRescan }: AppHeaderProps) {
  return (
    <header style={{borderBottomColor: colorData ? colorData : "rgba(0, 255, 255, 0.1)", paddingTop: "10px"}}>
      <div className="title" style={{fontSize: "20px", cursor: "pointer"}} onClick={() => setView("games")}>
        <Trophy size={24} color={colorData ? colorData : "var(--accent-cyan)"} style={{transition: "color 0.5s ease"}}/>
        Triumph <span style={{fontSize: "12px", color: "var(--text-muted)", fontWeight: 400}}>Unlocker {updateAvailable && <span style={{color: "cyan", fontSize: "11px", padding: "2px 6px", background: "rgba(0,255,255,0.1)", borderRadius: "4px", marginLeft: "5px"}}>v{updateAvailable.version}</span>}</span>
      </div>
      <div style={{display: "flex", gap: "15px"}}>
        <button className="btn btn-danger" onClick={onRescan}>
          <RefreshCw size={16} /> Rescan
        </button>
        <button className={`btn ${view === "shadow_log" ? "btn-primary" : ""}`} style={{padding: "8px", background: view === "shadow_log" ? "var(--accent-purple)" : "transparent"}} onClick={() => setView("shadow_log")}>
          <Terminal size={20} color={view === "shadow_log" ? "#fff" : "var(--text-muted)"}/>
        </button>
        <button className={`btn ${view === "settings" ? "btn-primary" : ""}`} style={{padding: "8px", background: view === "settings" ? "var(--accent-cyan)" : "transparent"}} onClick={() => setView("settings")}>
          <Settings size={20} color={view === "settings" ? "#000" : "var(--text-muted)"}/>
        </button>
      </div>
    </header>
  );
}
