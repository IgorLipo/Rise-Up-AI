"use client";

import { useState, useRef, useEffect } from "react";

export type DateRangePreset = "all" | "this-month" | "last-month" | "last-3m" | "last-6m" | "custom";

interface DateRangeSelectorProps {
  value: { preset: DateRangePreset; from?: string; to?: string };
  onChange: (range: { preset: DateRangePreset; from?: string; to?: string }) => void;
}

const PRESETS: Array<{ value: DateRangePreset; label: string }> = [
  { value: "all", label: "All time" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-3m", label: "Last 3 months" },
  { value: "last-6m", label: "Last 6 months" },
  { value: "custom", label: "Custom range" },
];

function computeDateRange(preset: DateRangePreset): { from?: string; to?: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);

  switch (preset) {
    case "this-month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { from, to };
    }
    case "last-month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
    }
    case "last-3m": {
      const from = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
      return { from, to };
    }
    case "last-6m": {
      const from = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().slice(0, 10);
      return { from, to };
    }
    default:
      return {};
  }
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from ?? "");
  const [customTo, setCustomTo] = useState(value.to ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = PRESETS.find((p) => p.value === value.preset)?.label ?? "All time";

  const handlePreset = (preset: DateRangePreset) => {
    if (preset === "custom") {
      onChange({ preset, from: customFrom || undefined, to: customTo || undefined });
    } else {
      const { from, to } = computeDateRange(preset);
      onChange({ preset, from, to });
      setOpen(false);
    }
  };

  const handleCustomApply = () => {
    onChange({ preset: "custom", from: customFrom || undefined, to: customTo || undefined });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {selectedLabel}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-zinc-200 rounded-xl shadow-lg z-30 py-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handlePreset(preset.value)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                value.preset === preset.value
                  ? "bg-zinc-100 text-zinc-900 font-medium"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {preset.label}
            </button>
          ))}

          {value.preset === "custom" && (
            <div className="border-t border-zinc-100 px-3 py-2 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-zinc-400 w-8">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="flex-1 text-xs border border-zinc-200 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-zinc-400 w-8">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="flex-1 text-xs border border-zinc-200 rounded px-2 py-1 focus:outline-none focus:border-zinc-400"
                />
              </div>
              <button
                onClick={handleCustomApply}
                className="w-full py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
