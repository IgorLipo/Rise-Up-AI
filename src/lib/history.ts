export interface DocumentHistoryEntry {
  id: string;
  filename: string;
  uploadedAt: string;
  mode: "personal" | "business";
  insightCount: number;
  topFinding: string;
  cashFlowHealth: string;
  netFlow: number;
}

const STORAGE_KEY = "documentHistory";

export function getDocumentHistory(): DocumentHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDocumentHistory(entry: DocumentHistoryEntry): void {
  if (typeof window === "undefined") return;
  try {
    const history = getDocumentHistory();
    history.unshift(entry);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
  } catch {
    // sessionStorage full or unavailable
  }
}
