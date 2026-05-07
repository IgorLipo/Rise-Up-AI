import Link from "next/link";

export function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <h1 className="text-xl font-bold text-zinc-900 mb-2">No statements yet</h1>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">
        Upload your first bank statement to see your cashflow forecast, spending breakdown, and AI-powered insights.
      </p>
      <Link
        href="/upload"
        className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
      >
        Upload a statement
      </Link>
    </div>
  );
}
