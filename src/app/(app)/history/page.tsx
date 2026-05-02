"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getDocumentHistory, type DocumentHistoryEntry } from "@/lib/history";
import { listDocuments } from "@/lib/db";
import { DocumentHistoryCard } from "@/components/history/document-history-card";

export default function HistoryPage() {
  const [entries, setEntries] = useState<DocumentHistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listDocuments()
      .then((docs) => {
        if (docs.length > 0) {
          setEntries(docs);
        } else {
          setEntries(getDocumentHistory());
        }
      })
      .catch(() => setEntries(getDocumentHistory()))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 pb-24 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-warm-black dark:text-warm-white">
          Document history
        </h1>
        <p className="mt-1 text-warm-black/45 dark:text-warm-white/35">
          Previously uploaded statements and their insights.
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
          <p className="text-sm text-warm-black/40 dark:text-warm-white/30 mb-6">
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
              onClick={() => {
                // For now, navigate to dashboard — in future, restore session from history
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
