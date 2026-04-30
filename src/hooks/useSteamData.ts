import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import toast from "react-hot-toast";
import type { Achievement, AchievementFilter, SteamGame, VaultBackup } from "../types";
import { getErrorMessage, parseWorkerStatus } from "../utils/worker";

export function useSteamData() {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [search, setSearch] = useState("");
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAch, setLoadingAch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<AchievementFilter>("all");
  const [cacheBust, setCacheBust] = useState<number>(0);
  const [colorData, setColorData] = useState<string | null>(null);
  const [idlingGames, setIdlingGames] = useState<Record<string, number>>({});
  const [vaults, setVaults] = useState<VaultBackup[]>([]);
  const [showVault, setShowVault] = useState(false);

  const writeLog = async (action: string) => {
    try {
      const ts = new Date().toLocaleString();
      await invoke("log_action", { timestamp: ts, action });
    } catch (e) {}
  };

  const syncGhostGames = async (currentGames: SteamGame[]) => {
    try {
      const gGames: SteamGame[] = await invoke("fetch_global_games");
      const existingIds = new Set(currentGames.map(g => g.appid.toString()));
      const newGhosts = gGames.filter((g) => !existingIds.has(g.appid.toString()));
      if (newGhosts.length > 0) {
        setGames(prev => {
          const combined = [...prev, ...newGhosts];
          return combined.sort((a,b) => {
             const aInst = a.install_dir === "FANTASMA" ? 0 : 1;
             const bInst = b.install_dir === "FANTASMA" ? 0 : 1;
             return bInst - aInst;
          });
        });
        toast.success(`Localizados ${newGhosts.length} jogos nÃ£o instalados do seu cofre!`);
      }
    } catch(e) {
      console.error("syncGhostGames error:", e);
      toast.error(`Falha ao buscar jogos fantasma: ${e}`, { duration: 6000 });
    }
  };

  async function fetchGames(isRescan = false) {
    if (!isRescan) setLoading(true);

    if (isRescan) {
      setSelectedGame(null);
      setAchievements([]);
      setColorData(null);
      setFilter("all");
      setErrorMsg(null);
      setCacheBust(Date.now());
      toast.success("Cache limpo! Buscando dados frescos...", { icon: "ðŸ”„" });
    }

    try {
      const res: SteamGame[] = await invoke("get_games");
      setGames(res);
      setLoading(false);
      return res;
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to load games. Make sure Steam is installed.");
      setLoading(false);
      return [];
    }
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

  const backupVault = async (app: SteamGame, currentAchs: Achievement[]) => {
    try {
      const timestamp = Date.now().toString();
      const payload = JSON.stringify(currentAchs.map(a => ({ id: a.id, unlocked: a.unlocked })));
      await invoke("save_vault_state", { appid: app.appid.toString(), timestampId: timestamp, payload });
    } catch (e) { console.error("Vault backup failed", e); }
  };

  const loadVaults = async () => {
    if (!selectedGame) return;
    try {
      const res = await invoke<VaultBackup[]>("list_vaults", { appid: selectedGame.appid.toString() });
      setVaults(res);
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
      parseWorkerStatus(result);
      toast.success("Time altered! Cloud Vault Restored.");
      writeLog(`Restaurou o estado do jogo ${selectedGame.name} para o backup temporal de [${timestampId}]`);
      await loadAchievements(selectedGame);
    } catch (e) {
      toast.error(`Restore failed: ${getErrorMessage(e)}`);
      setLoadingAch(false);
    }
  };

  async function toggleAchievement(achId: string, currentState: boolean) {
    if (!selectedGame) return;
    setAchievements(prev => prev.map(a => a.id === achId ? { ...a, unlocked: !currentState } : a));
    writeLog(`${currentState ? "Bloqueou" : "Desbloqueou"} a conquista [${achId}] no jogo ${selectedGame.name}`);
    
    try {
      const result: string = await invoke("run_worker", {
        appid: selectedGame.appid,
        args: ["toggle", achId, (!currentState).toString()]
      });
      
      parseWorkerStatus(result);
      toast.success(currentState ? "Achievement Locked" : "Achievement Unlocked!");
    } catch (e) {
      console.error(e);
      setAchievements(prev => prev.map(a => a.id === achId ? { ...a, unlocked: currentState } : a));
      toast.error(`Failed to toggle achievement: ${getErrorMessage(e)}`);
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
        toast(`Iniciando simulaÃ§Ã£o fantasma de ${selectedGame.name}! (Dropando cartas...)`);
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
      parseWorkerStatus(result);
      toast.success("Successfully unlocked all!");
      await loadAchievements(selectedGame);
    } catch (e) {
      console.error(e);
      toast.error(`Failed to unlock all: ${getErrorMessage(e)}`);
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
      parseWorkerStatus(result);
      toast.success("Successfully locked all!");
      await loadAchievements(selectedGame);
    } catch (e) {
      console.error(e);
      toast.error(`Failed to lock all: ${getErrorMessage(e)}`);
      setLoadingAch(false);
    }
  }

  const extractColor = useCallback((url: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 50; canvas.height = 28;
        const ctx = canvas.getContext("2d");
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
    img.src = url + (cacheBust ? `?t=${cacheBust}` : "");
  }, [cacheBust]);

  useEffect(() => {
    if (selectedGame) {
      setColorData(null);
      extractColor(selectedGame.header_url);
    }
  }, [selectedGame, extractColor]);

  useEffect(() => {
    const activeIdlers = Object.keys(idlingGames);
    if (activeIdlers.length === 0) return;

    const intervalId = setInterval(() => {
      const HOUR_INCREMENT = 1 / 3600;
      
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

  const rescanGames = async () => {
    try { await invoke("wipe_caches"); } catch (e) { }
    fetchGames(true).then((g) => { if (g && g.length > 0) syncGhostGames(g); });
  };

  return {
    games,
    search,
    setSearch,
    selectedGame,
    achievements,
    loading,
    loadingAch,
    errorMsg,
    filter,
    setFilter,
    cacheBust,
    colorData,
    idlingGames,
    vaults,
    showVault,
    setShowVault,
    syncGhostGames,
    fetchGames,
    rescanGames,
    loadAchievements,
    loadVaults,
    executeVaultRestore,
    toggleAchievement,
    toggleIdle,
    unlockAll,
    lockAll,
  };
}
