import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import toast from "react-hot-toast";
import type { UpdateInfo } from "../types";

export function useWindowControls() {
  const appWindow = getCurrentWindow();
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    isEnabled().then(setAutoStart).catch(() => {});
    getVersion().then(setAppVersion).catch(() => {});
    void checkForUpdates({ silent: true });
  }, []);

  const toggleAutoStart = async () => {
    try {
      if (autoStart) {
        await disable();
        setAutoStart(false);
      } else {
        await enable();
        setAutoStart(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

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
    setShowCloseDialog(true);
  };

  const confirmClose = async () => {
    try { await invoke("kill_all_workers"); } catch (e) { }
    try { await invoke("close_app"); } catch (e) { }
  };

  const confirmMinimizeTray = async () => {
    setShowCloseDialog(false);
    try { await invoke("hide_app"); } catch (e) { }
  };

  async function checkForUpdates(options: { silent?: boolean } = {}) {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      const update = await check();
      if (update) {
        const updateInfo = update as UpdateInfo;
        setUpdateAvailable(updateInfo);
        toast.custom((t) => (
          <div className="glass-panel" style={{padding: "15px", display: "flex", gap: "15px", alignItems: "center"}}>
            <span style={{fontSize: "15px", fontWeight: 700, color: "var(--accent-cyan)"}}>Nova versão</span>
            <div>
              <b>Nova versão disponível!</b>
              <div style={{fontSize: "12px", color: "var(--text-muted)"}}>{updateInfo.version}</div>
            </div>
            <button className="btn btn-primary" onClick={async () => {
              toast.dismiss(t.id);
              const installToast = toast.loading("Baixando atualização...");
              try {
                await updateInfo.downloadAndInstall();
                toast.success("Pronto! Reiniciando...", {id: installToast});
                await relaunch();
              } catch(e) {
                toast.error("Falha ao atualizar.", {id: installToast});
                toast.custom((fallbackToast) => (
                  <div className="glass-panel" style={{padding: "15px", display: "flex", gap: "15px", alignItems: "center"}}>
                    <div>
                      <b>Instalação automática falhou</b>
                      <div style={{fontSize: "12px", color: "var(--text-muted)"}}>Baixe a versão mais recente pelo GitHub.</div>
                    </div>
                    <button className="btn btn-primary" onClick={async () => {
                      toast.dismiss(fallbackToast.id);
                      await openUrl("https://github.com/Rakjsu/Triumph/releases/latest");
                    }}>Abrir Releases</button>
                  </div>
                ), {duration: 12000});
              }
            }}>Instalar</button>
          </div>
        ), {duration: 10000});
      } else if (!options.silent) {
        toast.success("Você já está na versão mais recente.");
      }
    } catch(e) {
      console.log("Updater: no update or not configured", e);
      if (!options.silent) {
        toast.error("Não foi possível verificar atualizações.");
      }
    }
  }

  return {
    appWindow,
    autoStart,
    appVersion,
    updateAvailable,
    showCloseDialog,
    setShowCloseDialog,
    toggleAutoStart,
    handleMaximize,
    handleClose,
    confirmClose,
    confirmMinimizeTray,
    checkForUpdates,
  };
}
