import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppView } from "../types";

export function useShadowLog(view: AppView) {
  const [logsText, setLogsText] = useState<string>("");

  useEffect(() => {
    if (view === "shadow_log") {
      invoke("get_logs").then(res => setLogsText(res as string)).catch(console.error);
    }
  }, [view]);

  return { logsText };
}
