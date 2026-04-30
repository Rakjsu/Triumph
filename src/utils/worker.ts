import type { WorkerStatus } from "../types";

export function getErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw) as Partial<WorkerStatus>;
    if (parsed.error) return parsed.error;
  } catch {
    // Fall through to the raw message.
  }
  return raw || "Unknown worker error";
}

export function parseWorkerStatus(result: string): WorkerStatus {
  let parsed: Partial<WorkerStatus>;
  try {
    parsed = JSON.parse(result);
  } catch {
    throw new Error("Worker returned an invalid response");
  }

  if (!parsed.success) {
    throw new Error(parsed.error || "Worker operation failed");
  }

  return { success: true };
}
