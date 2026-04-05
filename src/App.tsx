import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Search, Trophy, Unlock, ServerCrash, RefreshCw, Lock, Settings, Minus, Square, X, Play, Terminal, Cloud, FileText } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
// Color thief removed from import - using canvas-based extraction instead

interface SteamGame {
  appid: string;
  name: string;
  install_dir: string;
  icon_url: string;
  header_url: string;
  playtime_hours: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  hidden: boolean;
  icon_rgba?: number[];
}

// Convert RGBA byte array from Rust to Base64 Image (supports any size: 64, 128, 256px)
function rgbaToBase64(rgbaBuffer: number[]): string {
  try {
    // Determine size from buffer length: size = sqrt(len / 4)
    const pixelCount = rgbaBuffer.length / 4;
    const size = Math.round(Math.sqrt(pixelCount));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    const imgData = ctx.createImageData(size, size);
    for (let i = 0; i < rgbaBuffer.length; i++) {
      imgData.data[i] = rgbaBuffer[i];
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (e) {
    return "";
  }
}

function App() {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [search, setSearch] = useState("");
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAch, setLoadingAch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);
  const [cacheBust, setCacheBust] = useState<number>(0);
  const [view, setView] = useState<'games' | 'settings' | 'shadow_log'>('games');
  const [idlingGames, setIdlingGames] = useState<Record<string, number>>({});
  
  const [vaults, setVaults] = useState<any[]>([]);
  const [showVault, setShowVault] = useState(false);
  const [logsText, setLogsText] = useState<string>("");
  const appWindow = getCurrentWindow();

  const handleMaximize = async () => {
    try {
      if (await appWindow.isMaximized()) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClose = async () => {
    try {
      await invoke("kill_all_workers");
    } catch (e) { console.error(e); }
    try {
      await appWindow.close();
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchGames(true);
    checkForUpdates();
  }, []);

  useEffect(() => {
    if (view === 'shadow_log') {
      invoke("get_logs").then(res => setLogsText(res as string)).catch(console.error);
    }
  }, [view]);

  const loadVaults = async () => {
    if (!selectedGame) return;
    try {
      const res = await invoke("list_vaults", { appid: selectedGame.appid.toString() });
      setVaults(res as any[]);
      setShowVault(true);
    } catch (e) { toast.error("Failed to list backups") }
  };

  const executeVaultRestore = async (timestampId: string) => {
    if (!selectedGame) return;
    setLoadingAch(true);
    setShowVault(false);
    try {
      const filePath: string = await invoke("get_vault_path", { appid: selectedGame.appid.toString(), timestampId });
      const result: string = await invoke("run_worker", {
        appid: selectedGame.appid,
        args: ["restore", filePath]
      });
      const parsed = JSON.parse(result);
      if (parsed.success) {
        toast.success("Time altered! Cloud Vault Restored.");
        writeLog(`Restaurou o estado do jogo ${selectedGame.name} para o backup temporal de [${timestampId}]`);
        await loadAchievements(selectedGame);
      }
    } catch (e) {
      toast.error(`Restore failed: ${e}`);
      setLoadingAch(false);
    }
  };

  async function checkForUpdates() {
    try {
      // Dynamic import prevents crash if updater not configured
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        setUpdateAvailable(update);
        toast.custom((t) => (
          <div className="glass-panel" style={{padding: '15px', display: 'flex', gap: '15px', alignItems: 'center'}}>
            <span style={{fontSize: '20px'}}>⬆️</span>
            <div>
               <b>Nova Versão Disponível!</b>
               <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>{update.version}</div>
            </div>
            <button className="btn btn-primary" onClick={async () => {
              toast.dismiss(t.id);
              const installToast = toast.loading("Baixando atualização...");
              try {
                await update.downloadAndInstall();
                toast.success("Pronto! Reiniciando...", {id: installToast});
              } catch(e) {
                toast.error("Falha ao atualizar.", {id: installToast});
              }
            }}>Instalar</button>
          </div>
        ), {duration: 10000});
      }
    } catch(e) {
      // Silently fail in dev mode or when GitHub release not yet published
      console.log("Updater: no update or not configured", e);
    }
  }

  async function fetchGames(isRescan = false) {
    setLoading(true);

    if (isRescan) {
      // Full cache wipe — reset all state
      setSelectedGame(null);
      setAchievements([]);
      setColorData(null);
      setFilter("all");
      setErrorMsg(null);

      // Bust browser image cache for Steam CDN by reloading images with a timestamp
      // We use a global cache-bust key stored in state
      setCacheBust(Date.now());

      toast.success("Cache limpo! Buscando dados frescos...", { icon: "🔄" });
    }

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
    setFilter("all");
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

  const writeLog = async (action: string) => {
    try {
      const ts = new Date().toLocaleString()
      await invoke("log_action", { timestamp: ts, action });
    } catch (e) {}
  };

  const backupVault = async (app: SteamGame, currentAchs: Achievement[]) => {
    try {
      const timestamp = Date.now().toString();
      const payload = JSON.stringify(currentAchs.map(a => ({ id: a.id, unlocked: a.unlocked })));
      await invoke("save_vault_state", { appid: app.appid.toString(), timestampId: timestamp, payload });
    } catch (e) { console.error("Vault backup failed", e); }
  };

  async function toggleAchievement(achId: string, currentState: boolean) {
    if (!selectedGame) return;
    setAchievements(prev => prev.map(a => a.id === achId ? { ...a, unlocked: !currentState } : a));
    writeLog(`${currentState ? 'Bloqueou' : 'Desbloqueou'} a conquista [${achId}] no jogo ${selectedGame.name}`);
    
    try {
      const result: string = await invoke("run_worker", {
        appid: selectedGame.appid,
        args: ["toggle", achId, (!currentState).toString()]
      });
      
      const parsed = JSON.parse(result);
      if (!parsed.success) {
        throw new Error("Steamworks returned failure");
      }
      toast.success(currentState ? "Achievement Locked" : "Achievement Unlocked!");
    } catch (e) {
      console.error(e);
      setAchievements(prev => prev.map(a => a.id === achId ? { ...a, unlocked: currentState } : a));
      toast.error("Failed to toggle achievement");
    }
  }

  const toggleIdle = async () => {
    if (!selectedGame) return;
    const appIdStr = selectedGame.appid.toString();
    
    if (idlingGames[appIdStr]) {
      const pid = idlingGames[appIdStr];
      try {
        await invoke("stop_idle", { pid });
        setIdlingGames(prev => {
          const next = {...prev};
          delete next[appIdStr];
          return next;
        });
        toast(`Farming interrompido: ${selectedGame.name}`);
      } catch (e) {
        toast.error(`Falha ao parar: ${e}`);
      }
    } else {
      try {
        const pid: number = await invoke("start_idle", { appid: appIdStr });
        setIdlingGames(prev => ({...prev, [appIdStr]: pid}));
        toast(`Iniciando simulação fantasma de ${selectedGame.name}! (Dropando cartas...)`);
      } catch (e) {
        toast.error(`Falha ao iniciar farm: ${e}`);
      }
    }
  };

  async function unlockAll() {
    if (!selectedGame) return;
    await backupVault(selectedGame, achievements);
    writeLog(`Desbloqueou todas as conquistas do jogo ${selectedGame.name}`);
    setLoadingAch(true);
    try {
      const result: string = await invoke("run_worker", {
        appid: selectedGame.appid,
        args: ["unlock_all"]
      });
      const parsed = JSON.parse(result);
      if (parsed.success) {
        toast.success("Successfully unlocked all!");
        await loadAchievements(selectedGame);
      }
    } catch (e) {
      console.error(e);
      toast.error(`Failed to unlock all: ${e}`);
      setLoadingAch(false);
    }
  }

  async function lockAll() {
    if (!selectedGame) return;
    await backupVault(selectedGame, achievements);
    writeLog(`Bloqueou todas as conquistas do jogo ${selectedGame.name}`);
    setLoadingAch(true);
    try {
      const result: string = await invoke("run_worker", {
        appid: selectedGame.appid,
        args: ["lock_all"]
      });
      const parsed = JSON.parse(result);
      if (parsed.success) {
        toast.success("Successfully locked all!");
        await loadAchievements(selectedGame);
      }
    } catch (e) {
      console.error(e);
      toast.error(`Failed to lock all: ${e}`);
      setLoadingAch(false);
    }
  }

  const [colorData, setColorData] = useState<string | null>(null);

  // Extract accent color from game header via hidden canvas (no CORS issues)
  const extractColor = useCallback((url: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 50; canvas.height = 28;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 50, 28);
        const d = ctx.getImageData(0, 0, 50, 28).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < d.length; i += 16) {
          r += d[i]; g += d[i+1]; b += d[i+2]; count++;
        }
        if (count === 0) return;
        r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count);
        setColorData(`rgb(${r},${g},${b})`);
      } catch { setColorData(null); }
    };
    img.onerror = () => setColorData(null);
    // Add cache-busting only for color extraction canvas, NOT for the visible img
    img.src = url + (cacheBust ? `?t=${cacheBust}` : '');
  }, [cacheBust]);

  useEffect(() => {
    if (selectedGame) {
      setColorData(null);
      extractColor(selectedGame.header_url);
    }
  }, [selectedGame, extractColor]);

  // Real-time Visual Playtime Booster
  useEffect(() => {
    const activeIdlers = Object.keys(idlingGames);
    if (activeIdlers.length === 0) return;

    const intervalId = setInterval(() => {
      const HOUR_INCREMENT = 1 / 3600; // 1 second
      
      setGames(currentGames => currentGames.map(game => {
        if (idlingGames[game.appid.toString()]) {
          return { ...game, playtime_hours: parseFloat((game.playtime_hours + HOUR_INCREMENT).toFixed(4)) };
        }
        return game;
      }));

      setSelectedGame(current => {
        if (current && idlingGames[current.appid.toString()]) {
          return { ...current, playtime_hours: parseFloat((current.playtime_hours + HOUR_INCREMENT).toFixed(4)) };
        }
        return current;
      });

    }, 1000);

    return () => clearInterval(intervalId);
  }, [idlingGames]);

  const filteredGames = games.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const progressRatio = achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0;

  const displayAchievements = achievements.filter(a => {
    if (filter === "unlocked") return a.unlocked;
    if (filter === "locked") return !a.unlocked;
    return true;
  });

  return (
    <>
      <div className="titlebar">
        <div className="titlebar-content" data-tauri-drag-region style={{flex: 1, pointerEvents: 'auto', height: '100%', cursor: 'default'}}>
          <Trophy size={16} color="var(--accent-cyan)" style={{pointerEvents: 'none'}} />
          <span style={{pointerEvents: 'none'}}>Triumph Nexus</span>
        </div>
        <div className="titlebar-controls" style={{zIndex: 10, position: 'relative'}}>
          <button className="titlebar-button" onClick={() => appWindow.minimize()}>
            <Minus size={16} />
          </button>
          <button className="titlebar-button" onClick={handleMaximize}>
            <Square size={14} />
          </button>
          <button className="titlebar-button close-btn" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      <Toaster position="bottom-right" toastOptions={{style: {background: '#151b2b', color: '#fff', border: '1px solid rgba(0, 255, 255, 0.2)'}}}/>
      
      <header style={{borderBottomColor: colorData ? colorData : 'rgba(0, 255, 255, 0.1)', paddingTop: '10px'}}>
        <div className="title" style={{fontSize: '20px'}}>
          <Trophy size={24} color={colorData ? colorData : "var(--accent-cyan)"} style={{transition: 'color 0.5s ease'}}/>
          Triumph <span style={{fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400}}>Unlocker {updateAvailable && <span style={{color: 'cyan', fontSize: '11px', padding: '2px 6px', background: 'rgba(0,255,255,0.1)', borderRadius: '4px', marginLeft: '5px'}}>v{updateAvailable.version}</span>}</span>
        </div>
        <div style={{display: 'flex', gap: '15px'}}>
          <button className="btn btn-danger" onClick={() => fetchGames(true)}>
            <RefreshCw size={16} /> Rescan
          </button>
          <button className={`btn ${view === 'shadow_log' ? 'btn-primary' : ''}`} style={{padding: '8px', background: view === 'shadow_log' ? 'var(--accent-purple)' : 'transparent'}} onClick={() => setView('shadow_log')}>
            <Terminal size={20} color={view === 'shadow_log' ? '#fff' : 'var(--text-muted)'}/>
          </button>
          <button className={`btn ${view === 'settings' ? 'btn-primary' : ''}`} style={{padding: '8px', background: view === 'settings' ? 'var(--accent-cyan)' : 'transparent'}} onClick={() => setView('settings')}>
            <Settings size={20} color={view === 'settings' ? '#000' : 'var(--text-muted)'}/>
          </button>
        </div>
      </header>

      <main className="main-content">
        {view === 'settings' ? (
          <section className="dashboard" style={{alignItems: 'center'}}>
            <div style={{width: '100%', maxWidth: '600px'}}>
              <h2 style={{fontSize: '28px', marginBottom: '20px'}}>Global Settings</h2>
              
              <div className="glass-panel" style={{padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                    <div style={{fontSize: '18px', fontWeight: 600}}>System Optimization</div>
                    <div style={{fontSize: '13px', color: 'var(--text-muted)'}}>Background execution behavior</div>
                  </div>
                  <button className="btn" style={{border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', background: 'transparent'}}>Enable</button>
                </div>
                
                <div style={{height: '1px', background: 'rgba(255,255,255,0.05)'}}></div>

                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                    <div style={{fontSize: '18px', fontWeight: 600}}>Updates Manager</div>
                    <div style={{fontSize: '13px', color: 'var(--text-muted)'}}>Check for new Triumph versions</div>
                  </div>
                  <button className="btn btn-primary" onClick={checkForUpdates}>Check Now</button>
                </div>
              </div>
            </div>
          </section>
        ) : view === 'shadow_log' ? (
          <section className="dashboard" style={{alignItems: 'center', flex: 1}}>
            <div style={{width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '600px'}}>
              <h2 style={{fontSize: '28px', marginBottom: '20px', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '10px'}}><FileText size={28} /> Livro das Sombras</h2>
              <div className="glass-panel" style={{flex: 1, padding: '20px', overflowY: 'auto', fontFamily: 'monospace', color: '#0f0', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.8)', border: '1px solid var(--accent-purple)'}}>
                 {logsText ? logsText : "Nenhum registro espectral encontrado."}
              </div>
            </div>
          </section>
        ) : (
          <>
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
                  style={selectedGame?.appid === g.appid ? {borderColor: colorData ? colorData : '', background: colorData ? `linear-gradient(90deg, ${colorData}22 0%, transparent 100%)` : ''} : {}}
                >
                  <div style={{position: 'relative', width: '46px', height: '22px', flexShrink: 0}}>
                    <div className="game-icon-fallback" style={{display: 'none', position: 'absolute', top:0, left:0, width:'100%', height:'100%', background:'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', borderRadius:'4px', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'bold', color:'#000', opacity: 0.8}}>
                      {g.name.substring(0, 2).toUpperCase()}
                    </div>
                    <img 
                      src={g.icon_url + (cacheBust ? `?t=${cacheBust}` : '')} 
                      className="game-icon" 
                      alt="" 
                      style={{position: 'absolute', top:0, left:0, zIndex: 1}}
                      onError={(e) => { 
                        const fallback = g.header_url + (cacheBust ? `?t=${cacheBust}` : '');
                        if (e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback; 
                        } else {
                          // Both failed, hide image and show fallback sibling
                          e.currentTarget.style.display = 'none';
                          const prev = e.currentTarget.previousElementSibling as HTMLElement;
                          if (prev) prev.style.display = 'flex';
                        }
                      }} 
                    />
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', paddingLeft: '10px', overflow: 'hidden'}}>
                     <div className="game-name">{g.name}</div>
                     {g.playtime_hours > 0 && <div style={{fontSize: '11px', color: 'var(--text-muted)'}}>{g.playtime_hours.toFixed(1)} Horas</div>}
                  </div>
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
              <div className="spinner" style={{borderColor: colorData ? `${colorData} transparent transparent transparent` : ''}}></div>
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
              <div className="dashboard-header" style={{position: 'relative', overflow: 'hidden'}}>
                <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: colorData ? `radial-gradient(circle at right, ${colorData}44 0%, transparent 70%)` : '', zIndex: 0, transition: 'background 0.5s ease', pointerEvents: 'none'}}></div>
                <div style={{position: 'relative', zIndex: 1, flexShrink: 0, width: '300px', height: '141px'}}>
                   <div style={{display: 'none', position: 'absolute', top:0, left:0, width:'100%', height:'100%', background:'linear-gradient(135deg, #151b2b, var(--accent-purple))', borderRadius:'12px', alignItems:'center', justifyContent:'center', fontSize:'48px', fontWeight:'bold', color:'rgba(255,255,255,0.2)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)'}}>
                      {selectedGame.name.substring(0, 3).toUpperCase()}
                   </div>
                   <img 
                     key={selectedGame.appid + cacheBust.toString()}
                     src={selectedGame.header_url + (cacheBust ? `?t=${cacheBust}` : '')} 
                     alt={selectedGame.name.toString()} 
                     style={{display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1, borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)'}}
                     onError={(e) => { 
                       const fallback = selectedGame.icon_url + (cacheBust ? `?t=${cacheBust}` : '');
                       if (e.currentTarget.src !== fallback) {
                         e.currentTarget.src = fallback; 
                       } else {
                         e.currentTarget.style.display = 'none';
                         const prev = e.currentTarget.previousElementSibling as HTMLElement;
                         if (prev) prev.style.display = 'flex';
                       }
                     }} 
                   />
                </div>
                <div className="dashboard-info" style={{position: 'relative', zIndex: 1, width: '100%'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <div>
                      <h2>{selectedGame.name}</h2>
                      <div style={{color: 'var(--text-muted)', marginBottom: '10px'}}>
                        {selectedGame.playtime_hours > 0 && <span style={{marginRight: '15px'}}>⏱️ {selectedGame.playtime_hours.toFixed(1)} Horas de Jogo</span>}
                        {achievements.length > 0 ? (
                          <>🏆 Unlocked {unlockedCount} / {achievements.length} Achievements</>
                        ) : (
                          <>No Achievements Found to Unlock</>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {achievements.length > 0 && (
                    <div style={{width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginBottom: '15px', overflow: 'hidden'}}>
                       <div style={{height: '100%', width: `${progressRatio}%`, background: colorData ? colorData : 'var(--accent-cyan)', transition: 'width 0.5s ease', boxShadow: `0 0 10px ${colorData ? colorData : 'var(--accent-cyan)'}`}}></div>
                    </div>
                  )}

                  <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                    <button className="btn btn-primary" onClick={unlockAll} disabled={achievements.length === 0} style={{background: colorData ? colorData : ''}}>
                      <Unlock size={18} /> Unlock All
                    </button>
                    <button className="btn btn-danger" onClick={lockAll} disabled={achievements.length === 0}>
                      <Lock size={18} /> Lock All
                    </button>
                    <button 
                      className={`btn ${idlingGames[selectedGame.appid.toString()] ? 'btn-danger' : 'btn-primary'}`} 
                      onClick={toggleIdle} 
                      style={{background: idlingGames[selectedGame.appid.toString()] ? '' : 'transparent', border: `1px solid ${colorData || 'var(--accent-cyan)'}`, color: idlingGames[selectedGame.appid.toString()] ? '#fff' : (colorData || 'var(--accent-cyan)')}}
                    >
                      {idlingGames[selectedGame.appid.toString()] ? <Square size={18} /> : <Play size={18} />}
                      {idlingGames[selectedGame.appid.toString()] ? ' Parar Farm' : ' Simular Horas'}
                    </button>
                    <button className="btn" style={{border: '1px solid var(--accent-purple)', color: 'var(--accent-purple)', background: 'transparent'}} onClick={loadVaults}>
                      <Cloud size={18} /> Vault (Undo)
                    </button>

                    <div style={{flex: 1}}></div>

                    <div style={{display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '3px'}}>
                       <button className={`btn ${filter === 'all' ? 'btn-primary' : ''}`} style={filter !== 'all' ? {background: 'transparent'} : {}} onClick={() => setFilter('all')}>All</button>
                       <button className={`btn ${filter === 'unlocked' ? 'btn-primary' : ''}`} style={filter !== 'unlocked' ? {background: 'transparent'} : {}} onClick={() => setFilter('unlocked')}>Unlocked</button>
                       <button className={`btn ${filter === 'locked' ? 'btn-primary' : ''}`} style={filter !== 'locked' ? {background: 'transparent'} : {}} onClick={() => setFilter('locked')}>Locked</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="achievements-scroll" style={{flex: 1, overflowY: 'auto', paddingRight: '10px'}}>
                <div className="achievements-grid">
                  {displayAchievements.map((ach) => {
                     const b64Icon = ach.icon_rgba ? rgbaToBase64(ach.icon_rgba) : null;
                     return (
                      <div 
                        key={ach.id} 
                        className={`glass-panel achievement-card ${ach.unlocked ? 'unlocked' : ''}`}
                        onClick={() => toggleAchievement(ach.id, ach.unlocked)}
                        style={ach.unlocked && colorData ? {borderColor: `${colorData}66`, boxShadow: `0 8px 32px ${colorData}11`} : {}}
                      >
                        <div className="status-badge" style={ach.unlocked && colorData ? {background: colorData, boxShadow: `0 0 10px ${colorData}`} : {}}></div>
                        <div className="ach-icon" style={{padding: b64Icon ? 0 : '10px', overflow: 'hidden', background: ach.unlocked ? (colorData ? `${colorData}33` : 'rgba(0,255,255,0.1)') : 'rgba(255,255,255,0.05)'}}>
                          {b64Icon 
                            ? <img src={b64Icon} style={{width: '100%', height: '100%', objectFit: 'cover', filter: ach.unlocked ? 'none' : 'grayscale(80%) opacity(0.6)'}}/>
                            : <Trophy size={24} />}
                        </div>
                        <div className="ach-info">
                          <div className="ach-name">{ach.name}</div>
                          <div className="ach-desc">{ach.description || (ach.hidden ? 'Hidden Achievement' : '')}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </section>
        
        {showVault && (
          <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div className="glass-panel" style={{width: '450px', padding: '25px', border: '1px solid var(--accent-purple)', boxShadow: '0 0 40px rgba(150, 0, 255, 0.2)'}}>
              <h3 style={{marginBottom: '15px', color: '#fff', fontSize: '20px'}}>Restaurar Ponto Temporal</h3>
              <p style={{color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.4'}}>
                {vaults.length > 0 ? "Selecione um backup do Vault para reverter todas as conquistas deste jogo para o exato estado anterior." : "Nenhum backup encontrado para este jogo."}
              </p>
              <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', maxHeight: '250px', overflowY: 'auto', paddingRight: '10px'}}>
                {vaults.map((v: any) => (
                  <button key={v.timestamp} className="btn" style={{justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '12px', border: '1px solid rgba(255,255,255,0.1)'}} onClick={() => executeVaultRestore(v.timestamp)}>
                     <span style={{fontFamily: 'monospace', color: '#ccc'}}>{v.timestamp.replace(/_/g, ' as ').replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')}</span>
                     <span style={{color: 'var(--accent-purple)'}}>Restaurar</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-danger" style={{width: '100%'}} onClick={() => setShowVault(false)}>Cancelar Operação</button>
            </div>
          </div>
        )}

        </>
        )}
      </main>
    </>
  );
}

export default App;
