import { Search } from "lucide-react";
import type { SteamGame } from "../types";

interface GamesListProps {
  loading: boolean;
  filteredGames: SteamGame[];
  selectedGame: SteamGame | null;
  colorData: string | null;
  cacheBust: number;
  search: string;
  setSearch: (search: string) => void;
  loadAchievements: (game: SteamGame) => void;
}

export function GamesList({
  loading,
  filteredGames,
  selectedGame,
  colorData,
  cacheBust,
  search,
  setSearch,
  loadAchievements,
}: GamesListProps) {
  return (
    <aside className="games-list">
      <div className="search-box">
        <div style={{position: "relative"}}>
          <Search size={16} style={{position: "absolute", left: "10px", top: "12px", color: "var(--text-muted)"}} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search Games..." 
            style={{paddingLeft: "35px"}}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="games-scroll">
        {loading ? (
          <div style={{textAlign: "center", marginTop: "20px", color: "var(--text-muted)"}}>Scanning Steam...</div>
        ) : filteredGames.length === 0 ? (
          <div style={{textAlign: "center", marginTop: "20px", color: "var(--text-muted)"}}>No Games Found</div>
        ) : (
          filteredGames.map(g => (
            <div 
              key={g.appid.toString()} 
              className={`game-item ${selectedGame?.appid === g.appid ? "active" : ""}`}
              onClick={() => loadAchievements(g)}
              style={selectedGame?.appid === g.appid ? {borderColor: colorData ? colorData : "", background: colorData ? `linear-gradient(90deg, ${colorData}22 0%, transparent 100%)` : ""} : {}}
            >
              <div style={{position: "relative", width: "46px", height: "22px", flexShrink: 0}}>
                {g.install_dir === "FANTASMA" && (
                   <div style={{position: "absolute", top: "-5px", right: "-5px", background: "#ff00ff", color: "#fff", fontSize: "8px", fontWeight: "bold", padding: "1px 3px", borderRadius: "4px", zIndex: 5}}>FANTASMA</div>
                )}
                <div className="game-icon-fallback" style={{display: "none", position: "absolute", top:0, left:0, width:"100%", height:"100%", background:"linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))", borderRadius:"4px", alignItems:"center", justifyContent:"center", fontSize:"10px", fontWeight:"bold", color:"#000", opacity: 0.8}}>
                  {g.name.substring(0, 2).toUpperCase()}
                </div>
                <img 
                  src={g.icon_url + (cacheBust ? `?t=${cacheBust}` : "")} 
                  className="game-icon" 
                  alt="" 
                  style={{position: "absolute", top:0, left:0, zIndex: 1}}
                  onError={(e) => { 
                    const fallback = g.header_url + (cacheBust ? `?t=${cacheBust}` : "");
                    if (e.currentTarget.src !== fallback) {
                      e.currentTarget.src = fallback; 
                    } else {
                      e.currentTarget.style.display = "none";
                      const prev = e.currentTarget.previousElementSibling as HTMLElement;
                      if (prev) prev.style.display = "flex";
                    }
                  }} 
                />
              </div>
              <div style={{display: "flex", flexDirection: "column", paddingLeft: "10px", overflow: "hidden"}}>
                 <div className="game-name">{g.name}</div>
                 {g.playtime_hours > 0 && <div style={{fontSize: "11px", color: "var(--text-muted)"}}>{g.playtime_hours.toFixed(1)} Horas</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
