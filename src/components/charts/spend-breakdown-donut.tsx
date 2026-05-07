"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = [
 "#d4a853", "#4a6741", "#c17a4e", "#8b6b4d", "#6b8c5c",
 "#c9a96e", "#5a7a4a", "#b8956e", "#7a9a6e", "#a08060",
];

interface Props {
 data: { name: string; value: number }[];
 total: number;
 onCategoryClick?: (category: { name: string; value: number }) => void;
}

export function SpendBreakdownDonut({ data, total, onCategoryClick }: Props) {
 if (!data.length) {
 return (
 <div className="flex items-center justify-center h-[260px] text-sm text-zinc-400 text-zinc-500">
 No category data available
 </div>
 );
 }

 return (
 <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
 <div className="relative w-[180px] h-[180px] shrink-0">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={data}
 cx="50%"
 cy="50%"
 innerRadius={55}
 outerRadius={85}
 paddingAngle={2}
 dataKey="value"
 stroke="none"
 >
 {data.map((entry, i) => (
 <Cell
 key={i}
 fill={COLORS[i % COLORS.length]}
 className={onCategoryClick ? "cursor-pointer" : ""}
 onClick={onCategoryClick ? () => onCategoryClick(entry) : undefined}
 />
 ))}
 </Pie>
 <Tooltip
 contentStyle={{
 background: "rgba(255,255,255,0.95)",
 backdropFilter: "blur(8px)",
 border: "1px solid rgba(0,0,0,0.08)",
 borderRadius: "12px",
 fontSize: "13px",
 boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
 }}
 formatter={(value) => [formatCurrency(Number(value)), undefined]}
 />
 </PieChart>
 </ResponsiveContainer>
 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
 <span className="text-lg font-display font-bold text-zinc-900">
 {formatCurrency(total)}
 </span>
 <span className="text-[10px] text-zinc-400 text-zinc-500 font-mono uppercase tracking-wider">
 total
 </span>
 </div>
 </div>

 <div className="flex-1 w-full space-y-1.5">
 {data.map((entry, i) => {
 const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
 return (
 <div
 key={entry.name}
 className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${
 onCategoryClick
 ? "cursor-pointer hover:bg-zinc-100/30 hover:bg-zinc-50 active:scale-[0.98]"
 : "hover:bg-zinc-100/30 hover:bg-zinc-50"
 }`}
 onClick={onCategoryClick ? () => onCategoryClick(entry) : undefined}
 role={onCategoryClick ? "button" : undefined}
 tabIndex={onCategoryClick ? 0 : undefined}
 onKeyDown={onCategoryClick ? (e) => { if (e.key === "Enter" || e.key === " ") onCategoryClick(entry); } : undefined}
 >
 <div
 className="w-2.5 h-2.5 rounded-sm shrink-0"
 style={{ backgroundColor: COLORS[i % COLORS.length] }}
 />
 <span className="text-xs text-zinc-700 text-zinc-500 flex-1 truncate">
 {entry.name}
 </span>
 <span className="text-xs font-mono font-medium text-zinc-900 tabular-nums">
 {formatCurrency(entry.value)}
 </span>
 <span className="text-[10px] font-mono text-zinc-400 text-zinc-500 tabular-nums w-8 text-right">
 {pct}%
 </span>
 </div>
 );
 })}
 </div>
 </div>
 );
}
