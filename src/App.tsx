import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { AppHeader } from "./components/AppHeader";
import { CloseDialog } from "./components/CloseDialog";
import { DashboardView } from "./components/DashboardView";
import { GamesList } from "./components/GamesList";
import { SettingsView } from "./components/SettingsView";
import { ShadowLogView } from "./components/ShadowLogView";
import { TitleBar } from "./components/TitleBar";
import { VaultModal } from "./components/VaultModal";
import { useShadowLog } from "./hooks/useShadowLog";
import { useSteamData } from "./hooks/useSteamData";
import { useWindowControls } from "./hooks/useWindowControls";
import type { AppView } from "./types";

function App() {
  const [view, setView] = useState<AppView>("games");
  const steam = useSteamData();
  const windowControls = useWindowControls();
  const { logsText } = useShadowLog(view);

  useEffect(() => {
    steam.fetchGames(true).then((gamesData) => {
      if (gamesData && Array.isArray(gamesData) && gamesData.length > 0) {
        steam.syncGhostGames(gamesData);
      }
    });
    windowControls.checkForUpdates();
  }, []);

  const sortedGames = [...steam.games].sort((a, b) => {
    if (a.install_dir === "FANTASMA" && b.install_dir !== "FANTASMA") return 1;
    if (a.install_dir !== "FANTASMA" && b.install_dir === "FANTASMA") return -1;
    return a.name.localeCompare(b.name);
  });

  const filteredGames = sortedGames.filter(g => g.name.toLowerCase().includes(steam.search.toLowerCase()));
  const unlockedCount = steam.achievements.filter(a => a.unlocked).length;
  const progressRatio = steam.achievements.length > 0 ? (unlockedCount / steam.achievements.length) * 100 : 0;

  const displayAchievements = steam.achievements.filter(a => {
    if (steam.filter === "unlocked") return a.unlocked;
    if (steam.filter === "locked") return !a.unlocked;
    return true;
  });

  return (
    <>
      <TitleBar
        appWindow={windowControls.appWindow}
        onMaximize={windowControls.handleMaximize}
        onClose={windowControls.handleClose}
      />

      <Toaster position="bottom-right" toastOptions={{style: {background: "rgba(0,0,0,0.8)", padding: "12px", border: "1px solid var(--accent-cyan)", color: "#fff", fontSize: "13px"}, className: "glass-panel"}} />
      
      <AppHeader
        colorData={steam.colorData}
        updateAvailable={windowControls.updateAvailable}
        view={view}
        setView={setView}
        onRescan={steam.rescanGames}
      />

      <main className="main-content">
        {view === "settings" ? (
          <SettingsView
            autoStart={windowControls.autoStart}
            toggleAutoStart={windowControls.toggleAutoStart}
            checkForUpdates={windowControls.checkForUpdates}
          />
        ) : view === "shadow_log" ? (
          <ShadowLogView logsText={logsText} />
        ) : (
          <>
            <GamesList
              loading={steam.loading}
              filteredGames={filteredGames}
              selectedGame={steam.selectedGame}
              colorData={steam.colorData}
              cacheBust={steam.cacheBust}
              search={steam.search}
              setSearch={steam.setSearch}
              loadAchievements={steam.loadAchievements}
            />

            <DashboardView
              errorMsg={steam.errorMsg}
              loadingAch={steam.loadingAch}
              selectedGame={steam.selectedGame}
              achievements={steam.achievements}
              displayAchievements={displayAchievements}
              unlockedCount={unlockedCount}
              progressRatio={progressRatio}
              colorData={steam.colorData}
              cacheBust={steam.cacheBust}
              idlingGames={steam.idlingGames}
              filter={steam.filter}
              setFilter={steam.setFilter}
              unlockAll={steam.unlockAll}
              lockAll={steam.lockAll}
              toggleIdle={steam.toggleIdle}
              loadVaults={steam.loadVaults}
              toggleAchievement={steam.toggleAchievement}
            />

            <CloseDialog
              show={windowControls.showCloseDialog}
              onMinimizeTray={windowControls.confirmMinimizeTray}
              onCloseApp={windowControls.confirmClose}
              onCancel={() => windowControls.setShowCloseDialog(false)}
            />

            <VaultModal
              show={steam.showVault}
              vaults={steam.vaults}
              onRestore={steam.executeVaultRestore}
              onCancel={() => steam.setShowVault(false)}
            />
          </>
        )}
      </main>
    </>
  );
}

export default App;
