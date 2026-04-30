import { Cloud, Lock, Play, ServerCrash, Square, Trophy, Unlock } from "lucide-react";
import type { Achievement, AchievementFilter, SteamGame } from "../types";
import { rgbaToBase64 } from "../utils/images";

interface DashboardViewProps {
  errorMsg: string | null;
  loadingAch: boolean;
  selectedGame: SteamGame | null;
  achievements: Achievement[];
  displayAchievements: Achievement[];
  unlockedCount: number;
  progressRatio: number;
  colorData: string | null;
  cacheBust: number;
  idlingGames: Record<string, number>;
  filter: AchievementFilter;
  setFilter: (filter: AchievementFilter) => void;
  unlockAll: () => void;
  lockAll: () => void;
  toggleIdle: () => void;
  loadVaults: () => void;
  toggleAchievement: (achId: string, currentState: boolean) => void;
}

export function DashboardView({
  errorMsg,
  loadingAch,
  selectedGame,
  achievements,
  displayAchievements,
  unlockedCount,
  progressRatio,
  colorData,
  cacheBust,
  idlingGames,
  filter,
  setFilter,
  unlockAll,
  lockAll,
  toggleIdle,
  loadVaults,
  toggleAchievement,
}: DashboardViewProps) {
  return (
    <section className="dashboard">
      {errorMsg && (
        <div className="glass-panel" style={{padding: "15px", color: "#ff5555", marginBottom: "20px", display: "flex", alignItems: "center", gap: "15px"}}>
          <ServerCrash size={24} />
          {errorMsg}
        </div>
      )}

      {loadingAch && (
        <div className="loading-overlay glass-panel" style={{position: "absolute", zIndex: 50}}>
          <div className="spinner" style={{borderColor: colorData ? `${colorData} transparent transparent transparent` : ""}}></div>
          <div>Bypassing Mainframe...</div>
        </div>
      )}

      {!selectedGame && !loadingAch ? (
        <div style={{display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexDirection: "column", gap: "20px"}}>
          <Trophy size={64} opacity={0.2} />
          <h2>Select a game from the left to start</h2>
        </div>
      ) : selectedGame && (
        <>
          <div className="dashboard-header" style={{position: "relative", overflow: "hidden"}}>
            <div style={{position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: colorData ? `radial-gradient(circle at right, ${colorData}44 0%, transparent 70%)` : "", zIndex: 0, transition: "background 0.5s ease", pointerEvents: "none"}}></div>
            <div style={{position: "relative", zIndex: 1, flexShrink: 0, width: "300px", height: "141px"}}>
               <div style={{display: "none", position: "absolute", top:0, left:0, width:"100%", height:"100%", background:"linear-gradient(135deg, #151b2b, var(--accent-purple))", borderRadius:"12px", alignItems:"center", justifyContent:"center", fontSize:"48px", fontWeight:"bold", color:"rgba(255,255,255,0.2)", boxShadow: "0 4px 20px rgba(0,0,0,0.5)"}}>
                  {selectedGame.name.substring(0, 3).toUpperCase()}
               </div>
               <img 
                 key={selectedGame.appid + cacheBust.toString()}
                 src={selectedGame.header_url + (cacheBust ? `?t=${cacheBust}` : "")} 
                 alt={selectedGame.name.toString()} 
                 style={{display: "block", width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1, borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)"}}
                 onError={(e) => { 
                   const fallback = selectedGame.icon_url + (cacheBust ? `?t=${cacheBust}` : "");
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
            <div className="dashboard-info" style={{position: "relative", zIndex: 1, width: "100%"}}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start"}}>
                <div>
                  <h2>{selectedGame.name}</h2>
                  <div style={{color: "var(--text-muted)", marginBottom: "10px"}}>
                    {selectedGame.playtime_hours > 0 && <span style={{marginRight: "15px"}}>â±ï¸ {selectedGame.playtime_hours.toFixed(1)} Horas de Jogo</span>}
                    {achievements.length > 0 ? (
                      <>ðŸ† Unlocked {unlockedCount} / {achievements.length} Achievements</>
                    ) : (
                      <>No Achievements Found to Unlock</>
                    )}
                  </div>
                </div>
              </div>
              
              {achievements.length > 0 && (
                <div style={{width: "100%", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", marginBottom: "15px", overflow: "hidden"}}>
                   <div style={{height: "100%", width: `${progressRatio}%`, background: colorData ? colorData : "var(--accent-cyan)", transition: "width 0.5s ease", boxShadow: `0 0 10px ${colorData ? colorData : "var(--accent-cyan)"}`}}></div>
                </div>
              )}

              <div style={{display: "flex", gap: "10px", flexWrap: "wrap"}}>
                <button className="btn btn-primary" onClick={unlockAll} disabled={achievements.length === 0} style={{background: colorData ? colorData : ""}}>
                  <Unlock size={18} /> Unlock All
                </button>
                <button className="btn btn-danger" onClick={lockAll} disabled={achievements.length === 0}>
                  <Lock size={18} /> Lock All
                </button>
                <button 
                  className={`btn ${idlingGames[selectedGame.appid.toString()] ? "btn-danger" : "btn-primary"}`} 
                  onClick={toggleIdle} 
                  style={{background: idlingGames[selectedGame.appid.toString()] ? "" : "transparent", border: `1px solid ${colorData || "var(--accent-cyan)"}`, color: idlingGames[selectedGame.appid.toString()] ? "#fff" : (colorData || "var(--accent-cyan)")}}
                >
                  {idlingGames[selectedGame.appid.toString()] ? <Square size={18} /> : <Play size={18} />}
                  {idlingGames[selectedGame.appid.toString()] ? " Parar Farm" : " Simular Horas"}
                </button>
                <button className="btn" style={{border: "1px solid var(--accent-purple)", color: "var(--accent-purple)", background: "transparent"}} onClick={loadVaults}>
                  <Cloud size={18} /> Vault (Undo)
                </button>

                <div style={{flex: 1}}></div>

                <div style={{display: "flex", background: "rgba(0,0,0,0.3)", borderRadius: "6px", padding: "3px"}}>
                   <button className={`btn ${filter === "all" ? "btn-primary" : ""}`} style={filter !== "all" ? {background: "transparent"} : {}} onClick={() => setFilter("all")}>All</button>
                   <button className={`btn ${filter === "unlocked" ? "btn-primary" : ""}`} style={filter !== "unlocked" ? {background: "transparent"} : {}} onClick={() => setFilter("unlocked")}>Unlocked</button>
                   <button className={`btn ${filter === "locked" ? "btn-primary" : ""}`} style={filter !== "locked" ? {background: "transparent"} : {}} onClick={() => setFilter("locked")}>Locked</button>
                </div>
              </div>
            </div>
          </div>

          <div className="achievements-scroll" style={{flex: 1, overflowY: "auto", paddingRight: "10px"}}>
            <div className="achievements-grid">
              {displayAchievements.map((ach) => {
                 const b64Icon = ach.icon_rgba ? rgbaToBase64(ach.icon_rgba) : null;
                 return (
                  <div 
                    key={ach.id} 
                    className={`glass-panel achievement-card ${ach.unlocked ? "unlocked" : ""}`}
                    onClick={() => toggleAchievement(ach.id, ach.unlocked)}
                    style={ach.unlocked && colorData ? {borderColor: `${colorData}66`, boxShadow: `0 8px 32px ${colorData}11`} : {}}
                  >
                    <div className="status-badge" style={ach.unlocked && colorData ? {background: colorData, boxShadow: `0 0 10px ${colorData}`} : {}}></div>
                    <div className="ach-icon" style={{padding: b64Icon ? 0 : "10px", overflow: "hidden", background: ach.unlocked ? (colorData ? `${colorData}33` : "rgba(0,255,255,0.1)") : "rgba(255,255,255,0.05)"}}>
                      {b64Icon 
                        ? <img src={b64Icon} style={{width: "100%", height: "100%", objectFit: "cover", filter: ach.unlocked ? "none" : "grayscale(80%) opacity(0.6)"}}/>
                        : <Trophy size={24} />}
                    </div>
                    <div className="ach-info">
                      <div className="ach-name">{ach.name}</div>
                      <div className="ach-desc">{ach.description || (ach.hidden ? "Hidden Achievement" : "")}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
