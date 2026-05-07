import type { ForecastStatus } from "@/types";

const config: Record<ForecastStatus, { label: string; className: string }> = {
  safe:    { label: "Safe",    className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  watch:   { label: "Watch",   className: "bg-amber-50 text-amber-700 border-amber-200" },
  risk:    { label: "Risk",    className: "bg-red-50 text-red-700 border-red-200" },
  critical:{ label: "Critical",className: "bg-red-100 text-red-800 border-red-300" },
};

export function StatusBadge({ status, className = "" }: { status: ForecastStatus; className?: string }) {
  const c = config[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${c.className} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === "safe" ? "bg-emerald-500" : status === "watch" ? "bg-amber-500" : "bg-red-500"}`} />
      {c.label}
    </span>
  );
}
