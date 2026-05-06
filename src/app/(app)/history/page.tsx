"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getDocumentHistory, type DocumentHistoryEntry } from "@/lib/history";
import { DocumentHistoryCard } from "@/components/history/document-history-card";

export default function HistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<DocumentHistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    // TODO: replace with real companyId from auth once middleware is in place
    fetch("/api/documents")
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.documents.length > 0) {
          setEntries(json.documents);
        } else {
          setEntries(getDocumentHistory());
        }
      })
      .catch(() => setEntries(getDocumentHistory()))
      .finally(() => setLoaded(true));
  }, []);

  const handleEntryClick = useCallback(async (entry: DocumentHistoryEntry) => {
    setLoadingId(entry.id);
    try {
      // TODO: replace with real companyId from auth once middleware is in place
      const res = await fetch(`/api/documents/${entry.id}`);
      const json = await res.json();
      if (json.success && json.document) {
        const doc = json.document;
        sessionStorage.setItem("statementData", JSON.stringify(doc.statement_data));
        if (doc.insights) {
          sessionStorage.setItem("statementInsights", JSON.stringify(doc.insights));
        }
        sessionStorage.setItem("analysisMode", doc.mode);
        toast.success(`Loaded ${doc.filename}`);
        router.push("/dashboard");
      } else {
        toast.error("Document not found in database");
      }
    } catch {
      toast.error("Failed to load document");
    } finally {
      setLoadingId(null);
    }
  }, [router]);

  if (!loaded) return null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 pb-24 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-warm-black dark:text-warm-white">
          Document history
        </h1>
        <p className="mt-1 text-warm-black/45 dark:text-zinc-400">
          Previously uploaded statements and their full reports — click any to restore.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-warm-gray/50 dark:bg-white/[0.02]">
            <svg className="w-7 h-7 text-warm-black/20 dark:text-warm-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white mb-2">
            No document history
          </h2>
          <p className="text-sm text-warm-black/40 dark:text-zinc-400 mb-6">
            Upload a bank statement to see it here.
          </p>
          <Link
            href="/upload"
            className="inline-flex px-6 py-2.5 rounded-full bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
          >
            Upload a statement
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <DocumentHistoryCard
              key={entry.id}
              entry={entry}
              isLoading={loadingId === entry.id}
              onClick={() => handleEntryClick(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
