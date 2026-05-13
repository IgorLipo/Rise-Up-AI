"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { StatementData, ParseResult, AIInsights, SpendReviewResult, AnalysisMode, Insight } from "@/types";
import type { UploadSummary } from "@/lib/pipeline/upload-pipeline";
import { InsightCard } from "@/components/insight-card";
import { InsightDrawer } from "@/components/insight-drawer";
import { OwnerReviewPack } from "@/components/owner-review-pack";
import { DuplicateConfirmDialog } from "@/components/duplicate-confirm-dialog";
import { addDocumentHistory } from "@/lib/history";

type FileStatus = "queued" | "parsing" | "checking" | "analyzing" | "saving" | "done" | "skipped" | "error";

interface FileJob {
  name: string;
  status: FileStatus;
  transactionCount?: number;
  netFlow?: number;
  error?: string;
  skipReason?: string;
  data?: StatementData;
  insights?: AIInsights | SpendReviewResult;
  mode: AnalysisMode;
}

export default function UploadPage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>("business");
  const [processing, setProcessing] = useState(false);
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detail drawer state
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [legitimateIds, setLegitimateIds] = useState<Set<string>>(new Set());
  const [followUpIds, setFollowUpIds] = useState<Set<string>>(new Set());

  // Duplicate confirmation state
  const [duplicateDecision, setDuplicateDecision] = useState<{
    fileName: string;
    existingId: string;
    existingFilename: string;
    existingPeriod: string;
    resolve: (action: "replace" | "skip") => void;
  } | null>(null);

  const isBusiness = mode === "business";
  const hasFiles = jobs.length > 0;
  const allDone = jobs.length > 0 && jobs.every((j) => j.status === "done" || j.status === "skipped" || j.status === "error");
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const skipCount = jobs.filter((j) => j.status === "skipped").length;
  const errorCount = jobs.filter((j) => j.status === "error").length;

  // Pipeline summary — fetched after upload completes to show recalculation results
  const [pipelineSummary, setPipelineSummary] = useState<UploadSummary | null>(null);

  useEffect(() => {
    if (!allDone || doneCount === 0) return;
    let cancelled = false;
    fetch("/api/pipeline/recalculate", { method: "POST" })
      .then(r => r.json())
      .then(json => {
        if (cancelled || !json.success) return;
        setPipelineSummary(json.summary);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [allDone, doneCount]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ext === "pdf" || ext === "csv";
    });

    if (fileArr.length === 0) {
      toast.error("Please upload PDF or CSV bank statements");
      return;
    }

    const initialJobs: FileJob[] = fileArr.map((f) => ({
      name: f.name,
      status: "queued" as FileStatus,
      mode,
    }));

    setJobs(initialJobs);
    setProcessing(true);

    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];

      // Update to parsing
      setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: "parsing" } : j)));

      // Parse the file
      const isPDF = file.name.endsWith(".pdf");
      const endpoint = isPDF ? "/api/parse-pdf" : "/api/parse-csv";
      const formData = new FormData();
      formData.append("file", file);

      let parsed: StatementData;
      try {
        const res = await fetch(endpoint, { method: "POST", body: formData });
        const json: ParseResult = await res.json();

        if (!json.success || !json.data) {
          setJobs((prev) => prev.map((j, idx) =>
            idx === i ? { ...j, status: "error", error: json.error || "Failed to parse" } : j
          ));
          continue;
        }
        parsed = json.data;
      } catch {
        setJobs((prev) => prev.map((j, idx) =>
          idx === i ? { ...j, status: "error", error: "Network error during parsing" } : j
        ));
        continue;
      }

      // Check for duplicate period
      setJobs((prev) => prev.map((j, idx) =>
        idx === i ? { ...j, status: "checking" } : j
      ));

      const period = parsed.accountInfo?.statementPeriod;
      if (period?.from && period?.to) {
        try {
          const checkRes = await fetch("/api/documents/check-period", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: period.from, to: period.to }),
          });
          const checkJson = await checkRes.json();
          if (checkJson.exists) {
            const action = await new Promise<"replace" | "skip">((resolve) => {
              setDuplicateDecision({
                fileName: file.name,
                existingId: checkJson.existingDocumentId,
                existingFilename: checkJson.existingFilename,
                existingPeriod: checkJson.existingPeriod,
                resolve,
              });
            });
            setDuplicateDecision(null);

            if (action === "replace") {
              await fetch(`/api/documents/${checkJson.existingDocumentId}`, { method: "DELETE" });
              toast.success(`Replaced ${checkJson.existingFilename}`);
              // Fall through — continue to AI analysis + save
            } else {
              setJobs((prev) => prev.map((j, idx) =>
                idx === i ? {
                  ...j,
                  status: "skipped",
                  skipReason: `Skipped by user (period ${checkJson.existingPeriod} exists)`,
                } : j
              ));
              continue;
            }
          }
        } catch {
          // Non-critical — proceed even if check fails
        }
      }

      // Generate insights
      setJobs((prev) => prev.map((j, idx) =>
        idx === i ? { ...j, status: "analyzing", transactionCount: parsed.transactions.length } : j
      ));

      let fileInsights: AIInsights | SpendReviewResult | null = null;
      try {
        const insightRes = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: parsed, mode }),
        });
        const insightJson = await insightRes.json();
        if (insightJson.success) {
          fileInsights = insightJson.insights;
        }
      } catch {
        // Insights fail silently
      }

      // Save to Supabase
      setJobs((prev) => prev.map((j, idx) =>
        idx === i ? { ...j, status: "saving" } : j
      ));

      const docId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Save to history
      const bizInsights = mode === "business" ? (fileInsights as SpendReviewResult | null) : null;
      const personal = mode === "personal" ? (fileInsights as AIInsights | null) : null;
      addDocumentHistory({
        id: docId,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        mode,
        insightCount: bizInsights ? bizInsights.insights.length : personal ? personal.topRecommendations.length : 0,
        topFinding: bizInsights
          ? bizInsights.insights[0]?.short_title ?? ""
          : personal?.topRecommendations[0] ?? "",
        cashFlowHealth: bizInsights
          ? (bizInsights.executive_summary.estimated_monthly_savings.amount > 0 ? "good" : "fair")
          : personal?.cashFlowHealth ?? "fair",
        netFlow: parsed.summary.netFlow,
      });

      // Persist to DB
      let saved = false;
      try {
        const saveRes = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: docId,
            filename: file.name,
            mode,
            data: parsed,
            insights: fileInsights,
          }),
        });
        const saveJson = await saveRes.json();
        saved = saveJson.success === true;
      } catch {
        // Network error
      }

      if (!saved) {
        setJobs((prev) => prev.map((j, idx) =>
          idx === i ? { ...j, status: "error", error: "Failed to save to database" } : j
        ));
        continue;
      }

      const netFlow = parsed.summary.netFlow;
      setJobs((prev) => prev.map((j, idx) =>
        idx === i ? {
          ...j,
          status: "done",
          transactionCount: parsed.transactions.length,
          netFlow,
          data: parsed,
          insights: fileInsights ?? undefined,
        } : j
      ));

      toast.success(`Processed ${file.name} — ${parsed.transactions.length} transactions`);
    }

    setProcessing(false);

    const doneCount = fileArr.length - jobs.filter((j) => j.status === "error").length;
    if (doneCount > 0) {
      toast.success(`Successfully imported ${doneCount} statement${doneCount !== 1 ? "s" : ""}`);
    }
  }, [mode, jobs]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) processFiles(files);
    },
    [processFiles],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) processFiles(files);
    },
    [processFiles],
  );

  const lastDoneJob = [...jobs].reverse().find((j) => j.status === "done");

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-2">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-zinc-900">
            {processing
              ? `Processing ${jobs.filter((j) => j.status !== "queued").length}/${jobs.length} statements...`
              : allDone
                ? `Import complete — ${doneCount} statement${doneCount !== 1 ? "s" : ""}`
                : "Upload bank statements"}
          </h1>
          <p className="mt-2 text-zinc-500">
            {processing
              ? `${jobs.find((j) => j.status === "parsing" || j.status === "analyzing")?.name ?? "Working..."}`
              : allDone
                ? `${doneCount} imported${skipCount > 0 ? `, ${skipCount} skipped` : ""}${errorCount > 0 ? `, ${errorCount} failed` : ""}`
                : "Upload multiple PDFs at once. Duplicate statement periods are automatically skipped."}
          </p>
        </div>

        {!processing && !allDone && (
          <div className="flex rounded-full bg-zinc-100 p-0.5">
            {(["personal", "business"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  mode === m
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-600"
                }`}
              >
                {m === "personal" ? "Personal" : "Business"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Drop zone — show when no files processed */}
      {!hasFiles && (
        <label
          className={`mt-10 border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer block ${
            dragOver
              ? "border-zinc-900 bg-zinc-50"
              : "border-zinc-200 hover:border-zinc-300"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <span className="font-medium text-zinc-900">
              Drop your {isBusiness ? "business " : ""}bank statements here
            </span>
            <span className="text-sm text-zinc-400">
              or click to browse — PDF, CSV. You can select multiple files.
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv"
            multiple
            className="sr-only"
            onChange={handleChange}
          />
        </label>
      )}

      {/* Import progress / summary */}
      {hasFiles && (
        <div className="mt-10 space-y-6">
          {/* Import summary cards */}
          {allDone && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Imported", value: String(doneCount), tone: "positive" as const },
                { label: "Skipped", value: String(skipCount), tone: "neutral" as const },
                { label: "Failed", value: String(errorCount), tone: errorCount > 0 ? "negative" as const : "neutral" as const },
                { label: "Total Transactions", value: String(jobs.reduce((s, j) => s + (j.transactionCount ?? 0), 0)), tone: "neutral" as const },
              ].map((card) => (
                <div key={card.label} className="bg-white border border-zinc-200 rounded-xl p-4">
                  <span className="text-xs text-zinc-500 font-mono uppercase tracking-wider">{card.label}</span>
                  <p className={`mt-1 font-mono text-xl font-medium ${
                    card.tone === "positive" ? "text-emerald-600" : card.tone === "negative" ? "text-red-500" : "text-zinc-900"
                  }`}>{card.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Pipeline recalculation summary */}
          {pipelineSummary && doneCount > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <span className="font-mono text-xs text-zinc-500 uppercase tracking-wider">
                Pipeline Summary
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                <div className="text-center">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Latest Balance</span>
                  <p className="text-lg font-bold text-zinc-900 mt-0.5">
                    {pipelineSummary.latestBalance != null ? formatCurrency(pipelineSummary.latestBalance) : "—"}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">New Vendors</span>
                  <p className="text-lg font-bold text-zinc-900 mt-0.5">{pipelineSummary.newVendors.length}</p>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Patterns Updated</span>
                  <p className="text-lg font-bold text-zinc-900 mt-0.5">{pipelineSummary.updatedPatterns}</p>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Personal Items</span>
                  <p className={`text-lg font-bold mt-0.5 ${pipelineSummary.potentialPersonalExpenses > 0 ? "text-amber-600" : "text-zinc-400"}`}>
                    {pipelineSummary.potentialPersonalExpenses}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Per-file status list */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <span className="font-mono text-xs text-zinc-500 uppercase tracking-wider">
                {processing ? "Progress" : "Results"}
              </span>
            </div>
            <div className="divide-y divide-zinc-100">
              {jobs.map((job, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  {/* Status icon */}
                  <div className="shrink-0">
                    {job.status === "queued" && (
                      <div className="w-5 h-5 rounded-full border-2 border-zinc-200" />
                    )}
                    {(job.status === "parsing" || job.status === "checking") && (
                      <svg className="w-5 h-5 text-zinc-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {(job.status === "analyzing" || job.status === "saving") && (
                      <svg className="w-5 h-5 text-zinc-600 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {job.status === "done" && (
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                        <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {job.status === "skipped" && (
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                        <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                        </svg>
                      </div>
                    )}
                    {job.status === "error" && (
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                        <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{job.name}</p>
                    <p className="text-xs text-zinc-500">
                      {job.status === "queued" && "Waiting..."}
                      {job.status === "parsing" && "Parsing PDF..."}
                      {job.status === "checking" && "Checking for duplicates..."}
                      {job.status === "analyzing" && "AI analyzing spending patterns..."}
                      {job.status === "saving" && "Saving to database..."}
                      {job.status === "done" && `${job.transactionCount} transactions · Net flow ${formatCurrency(job.netFlow ?? 0)}`}
                      {job.status === "skipped" && job.skipReason}
                      {job.status === "error" && job.error}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions after completion */}
          {allDone && (
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setJobs([]);
                  setProcessing(false);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="px-6 py-2.5 rounded-full border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Upload more statements
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-6 py-2.5 rounded-full bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                View dashboard
              </button>
            </div>
          )}

          {/* Show insights for last completed file */}
          {allDone && lastDoneJob?.insights && lastDoneJob.data && (
            <div className="space-y-10">
              {/* Summary cards for last file */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Net Flow", value: formatCurrency(lastDoneJob.data.summary.netFlow), tone: lastDoneJob.data.summary.netFlow >= 0 ? "positive" : "negative" },
                  { label: isBusiness ? "Revenue" : "Total In", value: formatCurrency(lastDoneJob.data.summary.totalCredits), tone: "neutral" },
                  { label: isBusiness ? "Spend" : "Total Out", value: formatCurrency(lastDoneJob.data.summary.totalDebits), tone: "neutral" },
                  { label: "Transactions", value: String(lastDoneJob.data.summary.transactionCount), tone: "neutral" },
                ].map((card) => (
                  <div key={card.label} className="bg-white border border-zinc-200 rounded-xl p-4">
                    <span className="text-xs text-zinc-500 font-mono uppercase tracking-wider">{card.label}</span>
                    <p className={`mt-1 font-mono text-xl font-medium ${
                      card.tone === "positive" ? "text-emerald-600" : card.tone === "negative" ? "text-red-500" : "text-zinc-900"
                    }`}>{card.value}</p>
                  </div>
                ))}
              </div>

              {/* AI Insights */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl font-semibold text-zinc-900">
                    {isBusiness ? "Business Spend Review" : "AI Insights"}
                  </h2>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">
                    {isBusiness ? "DeepSeek Analysis" : "AI-Powered"}
                  </span>
                </div>

                {isBusiness && (lastDoneJob.insights as SpendReviewResult) ? (
                  <BusinessSpendReviewView
                    insights={lastDoneJob.insights as SpendReviewResult}
                    onCardClick={setSelectedInsight}
                    reviewedIds={reviewedIds}
                  />
                ) : !isBusiness && (lastDoneJob.insights as AIInsights) ? (
                  <PersonalInsightsView insights={lastDoneJob.insights as AIInsights} />
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insight Drawer */}
      <InsightDrawer
        insight={selectedInsight}
        onClose={() => setSelectedInsight(null)}
        onMarkReviewed={(id) => setReviewedIds((prev) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        })}
        onMarkLegitimate={(id) => setLegitimateIds((prev) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        })}
        onNeedsFollowUp={(id) => setFollowUpIds((prev) => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        })}
        reviewedIds={reviewedIds}
        legitimateIds={legitimateIds}
        followUpIds={followUpIds}
      />

      {/* Duplicate confirmation modal */}
      {duplicateDecision && (
        <DuplicateConfirmDialog
          duplicate={{
            fileName: duplicateDecision.fileName,
            existingFilename: duplicateDecision.existingFilename,
            existingPeriod: duplicateDecision.existingPeriod,
          }}
          onResolve={duplicateDecision.resolve}
        />
      )}
    </div>
  );
}

// ── Personal Insights Sub-Component ──

function PersonalInsightsView({ insights }: { insights: AIInsights }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500 font-mono uppercase tracking-wider">Cash Flow Health</span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            insights.cashFlowHealth === "excellent" ? "bg-emerald-100 text-emerald-600"
            : insights.cashFlowHealth === "good" ? "bg-zinc-100 text-zinc-700"
            : insights.cashFlowHealth === "fair" ? "bg-orange-100 text-orange-700"
            : "bg-red-100 text-red-700"
          }`}>{insights.cashFlowHealth}</span>
        </div>
        <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{insights.monthlyForecast.narrative}</p>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <h3 className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-3">Spending Patterns</h3>
        <ul className="space-y-2">
          {insights.spendingPatterns.map((p, i) => (
            <li key={i} className="text-sm text-zinc-700 flex gap-2">
              <span className="text-zinc-900 mt-0.5 shrink-0">-</span>{p}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <h3 className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-3">Savings Opportunities</h3>
        <ul className="space-y-2">
          {insights.savingsOpportunities.map((s, i) => (
            <li key={i} className="text-sm text-zinc-700 flex gap-2">
              <span className="text-emerald-600 mt-0.5 shrink-0">+</span>{s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Business Spend Review Sub-Component ──

function BusinessSpendReviewView({
  insights,
  onCardClick,
  reviewedIds,
}: {
  insights: SpendReviewResult;
  onCardClick: (insight: Insight) => void;
  reviewedIds: Set<string>;
}) {
  const { executive_summary, insights: items } = insights;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-zinc-200 rounded-xl p-6 border-l-4 border-zinc-900">
        <span className="font-mono text-xs text-zinc-700 uppercase tracking-wider">Executive Summary</span>
        <p className="text-sm text-zinc-700 leading-relaxed mb-4 mt-1">{executive_summary.plain_english_summary}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { label: "Items to Review", value: String(executive_summary.items_to_review) },
            { label: "Insights Found", value: String(items.length) },
            { label: "Est. Monthly Savings", value: formatCurrency(executive_summary.estimated_monthly_savings.amount), highlight: true },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg p-3 text-center ${card.highlight ? "bg-emerald-50" : "bg-zinc-50"}`}>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">{card.label}</p>
              <p className={`text-xl font-display font-bold mt-1 ${card.highlight ? "text-emerald-600" : "text-zinc-900"}`}>{card.value}</p>
            </div>
          ))}
        </div>
        {executive_summary.top_3_findings.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Top Findings</p>
            <ol className="list-decimal list-inside text-sm text-zinc-600 space-y-0.5">
              {executive_summary.top_3_findings.map((f, i) => <li key={i}>{f.title}</li>)}
            </ol>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
          <p className="text-sm text-zinc-500">No significant spending patterns detected.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((insight) => (
            <div key={insight.id} className="relative">
              {reviewedIds.has(insight.id) && (
                <span className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600">Reviewed</span>
              )}
              <InsightCard insight={insight} onClick={onCardClick} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCurrency(amount: number, currency = "£"): string {
  const formatted = Math.abs(amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount < 0 ? `-${currency}${formatted}` : `${currency}${formatted}`;
}
