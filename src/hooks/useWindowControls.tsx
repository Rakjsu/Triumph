import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import toast from "react-hot-toast";
import type { UpdateInfo } from "../types";

export function useWindowControls() {
  const appWindow = getCurrentWindow();
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    isEnabled().then(setAutoStart).catch(() => {});
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

  async function checkForUpdates() {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        const updateInfo = update as UpdateInfo;
        setUpdateAvailable(updateInfo);
        toast.custom((t) => (
          <div className="glass-panel" style={{padding: "15px", display: "flex", gap: "15px", alignItems: "center"}}>
            <span style={{fontSize: "20px"}}>â¬†ï¸</span>
            <div>
               <b>Nova VersÃ£o DisponÃ­vel!</b>
               <div style={{fontSize: "12px", color: "var(--text-muted)"}}>{updateInfo.version}</div>
            </div>
            <button className="btn btn-primary" onClick={async () => {
              toast.dismiss(t.id);
              const installToast = toast.loading("Baixando atualizaÃ§Ã£o...");
              try {
                await updateInfo.downloadAndInstall();
                toast.success("Pronto! Reiniciando...", {id: installToast});
              } catch(e) {
                toast.error("Falha ao atualizar.", {id: installToast});
              }
            }}>Instalar</button>
          </div>
        ), {duration: 10000});
      }
    } catch(e) {
      console.log("Updater: no update or not configured", e);
    }
  }

  return {
    appWindow,
    autoStart,
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
