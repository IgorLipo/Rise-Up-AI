// Shown automatically by Next.js during route transitions within (app)/*
// when the next page's server boundary hasn't streamed yet. Pairs with
// the NavProgress top-bar in (app)/layout.tsx for click-feedback.
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-zinc-200 rounded" />
          <div className="h-3 w-56 bg-zinc-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-zinc-100 rounded-lg" />
          <div className="h-9 w-36 bg-zinc-100 rounded-lg" />
        </div>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
        <div className="h-3 w-40 bg-zinc-100 rounded" />
        <div className="h-8 w-48 bg-zinc-200 rounded" />
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 bg-zinc-100 rounded" />
          ))}
        </div>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-4 h-48" />
    </div>
  );
}
