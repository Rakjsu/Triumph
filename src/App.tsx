import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Trophy, Unlock, ServerCrash, RefreshCw } from "lucide-react";

interface SteamGame {
  appid: string;
  name: string;
  install_dir: string;
  icon_url: string;
  header_url: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  hidden: boolean;
}

function App() {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [search, setSearch] = useState("");
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAch, setLoadingAch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchGames();
  }, []);

  async function fetchGames() {
    setLoading(true);
    try {
      const res: SteamGame[] = await invoke("get_games");
      setGames(res);
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to load games. Make sure Steam is installed.");
    }
    setLoading(false);
  }

  async function loadAchievements(game: SteamGame) {
    setSelectedGame(game);
    setLoadingAch(true);
    setErrorMsg(null);
    try {
      const result: string = await invoke("run_worker", { 
        appid: game.appid, 
        args: ["list"] 
      });
      const parsed: Achievement[] = JSON.parse(result);
      setAchievements(parsed);
    } catch (e) {
      console.error(e);
      setErrorMsg(`Failed to load achievements: ${e}`);
    }
    setLoadingAch(false);
  }

  async function toggleAchievement(achId: string, currentState: boolean) {
    if (!selectedGame) return;
    
    // Optimistic update
    setAchievements(prev => prev.map(a => a.id === achId ? { ...a, unlocked: !currentState } : a));
    
    try {
      const result: string = await invoke("run_worker", {
        appid: selectedGame.appid,
        args: ["toggle", achId, (!currentState).toString()]
      });
      
      const parsed = JSON.parse(result);
      if (!parsed.success) {
        throw new Error("Steamworks returned failure");
      }
    } catch (e) {
      console.error(e);
      // Revert optimism
      setAchievements(prev => prev.map(a => a.id === achId ? { ...a, unlocked: currentState } : a));
      setErrorMsg(`Failed to toggle achievement: ${e}`);
    }
  }

  async function unlockAll() {
    if (!selectedGame) return;
    setLoadingAch(true);
    try {
      const result: string = await invoke("run_worker", {
        appid: selectedGame.appid,
        args: ["unlock_all"]
      });
      
      const parsed = JSON.parse(result);
      if (parsed.success) {
        // Refresh achievements to show state
        await loadAchievements(selectedGame);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(`Failed to unlock all: ${e}`);
      setLoadingAch(false);
    }
  }

  const filteredGames = games.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <>
      <header>
        <div className="title">
          <Trophy size={28} color="var(--accent-cyan)" />
          Triumph <span style={{fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400}}>Nexus Unlocker</span>
        </div>
        <div style={{display: 'flex', gap: '15px'}}>
          <button className="btn btn-danger" onClick={fetchGames}>
            <RefreshCw size={16} /> Rescan
          </button>
        </div>
      </header>

      <main className="main-content">
        <aside className="games-list">
          <div className="search-box">
            <div style={{position: 'relative'}}>
              <Search size={16} style={{position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)'}} />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search Games..." 
                style={{paddingLeft: '35px'}}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="games-scroll">
            {loading ? (
              <div style={{textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)'}}>Scanning Steam...</div>
            ) : filteredGames.length === 0 ? (
              <div style={{textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)'}}>No Games Found</div>
            ) : (
              filteredGames.map(g => (
                <div 
                  key={g.appid.toString()} 
                  className={`game-item ${selectedGame?.appid === g.appid ? 'active' : ''}`}
                  onClick={() => loadAchievements(g)}
                >
                  <img src={g.icon_url} className="game-icon" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <div className="game-name">{g.name}</div>
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="dashboard">
          {errorMsg && (
            <div className="glass-panel" style={{padding: '15px', color: '#ff5555', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px'}}>
              <ServerCrash size={24} />
              {errorMsg}
            </div>
          )}

          {loadingAch && (
            <div className="loading-overlay glass-panel" style={{position: 'absolute', zIndex: 50}}>
              <div className="spinner"></div>
              <div>Bypassing Mainframe...</div>
            </div>
          )}

          {!selectedGame && !loadingAch ? (
            <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '20px'}}>
              <Trophy size={64} opacity={0.2} />
              <h2>Select a game from the left to start</h2>
            </div>
          ) : selectedGame && (
            <>
              <div className="dashboard-header">
                <div>
                   <img src={selectedGame.header_url} alt={selectedGame.name.toString()} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <div className="dashboard-info">
                  <h2>{selectedGame.name}</h2>
                  <div style={{color: 'var(--text-muted)', marginBottom: '10px'}}>
                    {achievements.length > 0 ? (
                      <>Unlocked {unlockedCount} / {achievements.length} Achievements</>
                    ) : (
                      <>No Achievements Found to Unlock</>
                    )}
                  </div>
                  <div style={{display: 'flex', gap: '10px'}}>
                    <button className="btn btn-primary" onClick={unlockAll} disabled={achievements.length === 0}>
                      <Unlock size={18} /> Unlock All
                    </button>
                  </div>
                </div>
              </div>

              <div className="achievements-scroll" style={{flex: 1, overflowY: 'auto', paddingRight: '10px'}}>
                <div className="achievements-grid">
                  {achievements.map(ach => (
                    <div 
                      key={ach.id} 
                      className={`glass-panel achievement-card ${ach.unlocked ? 'unlocked' : ''}`}
                      onClick={() => toggleAchievement(ach.id, ach.unlocked)}
                    >
                      <div className="status-badge"></div>
                      <div className="ach-icon">
                        <Trophy size={24} />
                      </div>
                      <div className="ach-info">
                        <div className="ach-name">{ach.name}</div>
                        <div className="ach-desc">{ach.description || (ach.hidden ? 'Hidden Achievement' : '')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}

export default App;
