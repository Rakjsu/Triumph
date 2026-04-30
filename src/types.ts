export interface SteamGame {
  appid: string;
  name: string;
  install_dir: string;
  icon_url: string;
  header_url: string;
  playtime_hours: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  hidden: boolean;
  icon_rgba?: number[];
}

export interface WorkerStatus {
  success: boolean;
  error?: string;
}

export interface VaultBackup {
  id: string;
  timestamp: string;
  appid: string;
}

export interface UpdateInfo {
  version: string;
  downloadAndInstall: () => Promise<void>;
}

export type AchievementFilter = "all" | "unlocked" | "locked";
export type AppView = "games" | "settings" | "shadow_log";
