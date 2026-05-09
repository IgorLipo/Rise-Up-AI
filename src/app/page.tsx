import Link from "next/link";

export default function Home() {
 return (
 <div className="relative min-h-screen bg-zinc-950 text-zinc-900 overflow-hidden">
 {/* Animated gradient background */}
 <div className="absolute inset-0 z-0">
 <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-zinc-950 to-sage-900/20 animate-pulse" style={{ animationDuration: "8s" }} />
 <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-3xl" />
 <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-sage-600/10 to-transparent rounded-full blur-3xl" />
 {/* Grid pattern */}
 <div
 className="absolute inset-0 opacity-[0.03]"
 style={{
 backgroundImage: "radial-gradient(circle, rgba(212,168,83,0.5) 1px, transparent 1px)",
 backgroundSize: "60px 60px",
 }}
 />
 </div>

 {/* Nav */}
 <nav className="relative z-10 fixed top-0 inset-x-0">
 <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl border-b border-white/[0.04]" />
 <div className="relative max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
 <span className="font-display text-xl font-bold text-white tracking-tight">
 Statement<span className="text-amber-400">Reader</span>
 </span>
 <div className="flex items-center gap-3">
 <Link
 href="/login"
 className="text-sm text-zinc-300 hover:text-white transition-colors"
 >
 Sign in
 </Link>
 <Link
 href="/register"
 className="btn-cta text-sm px-5 py-2.5"
 >
 Get started
 </Link>
 </div>
 </div>
 </nav>

 {/* Hero */}
 <section className="relative z-10 pt-32 pb-20 px-6">
 <div className="max-w-5xl mx-auto text-center">
 <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-300 font-mono mb-8">
 <span className="w-2 h-2 rounded-full bg-zinc-900 animate-pulse" />
 UK Bank Statements Supported
 </div>

 <h1 className="animate-fade-up font-display text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight leading-[1.04]">
 Your bank statements,
 <br />
 <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300">
 finally understood.
 </span>
 </h1>

 <p className="animate-fade-up animate-stagger-1 mt-8 text-lg sm:text-xl lg:text-2xl text-zinc-300 max-w-2xl mx-auto leading-relaxed font-light">
 Upload any bank statement — PDF or CSV — and get instant clarity on your cash flow,
 spending patterns, and a personalised AI-powered financial forecast.
 </p>

 <div className="animate-fade-up animate-stagger-2 mt-12 flex flex-col sm:flex-row items-center justify-center gap-5">
 <Link
 href="/upload"
 className="btn-cta inline-flex items-center gap-3 text-lg px-10 py-4"
 >
 Upload a statement
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
 </svg>
 </Link>
 <div className="flex items-center gap-3">
 <div className="flex -space-x-2">
 {["PDF", "CSV"].map((fmt) => (
 <span key={fmt} className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[10px] font-mono text-zinc-400">
 {fmt}
 </span>
 ))}
 </div>
 <span className="text-sm text-zinc-500">
 Free account. No bank connections.
 </span>
 </div>
 </div>

 {/* Trust indicators */}
 <div className="animate-fade-up animate-stagger-3 mt-16 flex items-center justify-center gap-8 flex-wrap">
 {[
 { value: "< 3s", label: "Processing time" },
 { value: "100%", label: "Client-side parsing" },
 { value: "10+", label: "UK banks supported" },
 ].map((stat) => (
 <div key={stat.label} className="text-center">
 <p className="font-display text-2xl font-bold text-zinc-200">{stat.value}</p>
 <p className="text-xs text-zinc-500 mt-1 font-mono uppercase tracking-wider">{stat.label}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* How it works */}
 <section className="relative z-10 py-24 px-6 bg-white/[0.02] border-y border-white/5">
 <div className="max-w-6xl mx-auto">
 <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-center text-white mb-4">
 Three steps to clarity
 </h2>
 <p className="text-center text-zinc-400 mb-16 max-w-lg mx-auto text-sm">
 No bank connections. Just upload and understand.
 </p>
 <div className="grid md:grid-cols-3 gap-8">
 {[
 {
 step: "01",
 title: "Upload your statement",
 body: "Drag and drop a PDF or CSV bank statement. We support every major UK bank format — no configuration required.",
 },
 {
 step: "02",
 title: "We parse everything",
 body: "Transactions are extracted, categorised, and organised automatically. See your money clearly for the first time.",
 },
 {
 step: "03",
 title: "Get actionable insights",
 body: "AI-powered analysis surfaces spending patterns, flags unusual activity, and forecasts your next month's cash flow.",
 },
 ].map((item, i) => (
 <div
 key={item.step}
 className="animate-fade-up bg-white border border-zinc-200 rounded-2xl p-8 flex flex-col gap-4 border-white/5"
 style={{ animationDelay: `${i * 0.15}s`, opacity: 0 }}
 >
 <span className="font-mono text-xs text-zinc-900 tracking-widest">
 {item.step}
 </span>
 <h3 className="font-display text-xl font-semibold text-white">
 {item.title}
 </h3>
 <p className="text-zinc-300 leading-relaxed text-sm">
 {item.body}
 </p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* Features */}
 <section className="relative z-10 py-24 px-6">
 <div className="max-w-6xl mx-auto">
 <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-center text-white mb-16">
 Everything you need
 </h2>
 <div className="grid md:grid-cols-2 gap-6">
 {[
 {
 title: "Cash flow timeline",
 desc: "See exactly how money moves in and out across months. Spot trends before they become problems.",
 icon: (
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
 </svg>
 ),
 },
 {
 title: "Smart categorisation",
 desc: "Every transaction is automatically sorted into categories — groceries, rent, entertainment, and more.",
 icon: (
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
 <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
 </svg>
 ),
 },
 {
 title: "Monthly forecast",
 desc: "AI predicts your next month's financial position based on your actual spending patterns.",
 icon: (
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
 </svg>
 ),
 },
 {
 title: "Spending breakdown",
 desc: "Understand where your money goes with visual category breakdowns and percentage analysis.",
 icon: (
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
 <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
 </svg>
 ),
 },
 {
 title: "Unusual activity flags",
 desc: "Get alerted to transactions that don't fit your normal pattern — catch issues early.",
 icon: (
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
 </svg>
 ),
 },
 {
 title: "Savings opportunities",
 desc: "Concrete, personalised recommendations for where you could save, based on your real data.",
 icon: (
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
 </svg>
 ),
 },
 ].map((f, i) => (
 <div
 key={f.title}
 className="animate-fade-up flex gap-4 p-6 rounded-xl bg-white border border-zinc-200 border-white/5 hover:border-zinc-900/20 transition-colors group"
 style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}
 >
 <div className="shrink-0 w-10 h-10 rounded-xl bg-zinc-900/10 flex items-center justify-center text-zinc-900 group-hover:bg-zinc-900 group-hover:text-zinc-900 transition-all">
 {f.icon}
 </div>
 <div>
 <h3 className="font-display text-lg font-semibold text-white">
 {f.title}
 </h3>
 <p className="mt-1 text-sm text-zinc-300 leading-relaxed">
 {f.desc}
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* CTA */}
 <section className="relative z-10 py-24 px-6">
 <div className="max-w-3xl mx-auto text-center">
 <div className="bg-white border border-zinc-200 rounded-3xl p-12 sm:p-16 border-white/5 relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent" />
 <div className="relative">
 <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
 Ready to understand your money?
 </h2>
 <p className="mt-4 text-zinc-300 max-w-md mx-auto text-lg">
 Upload your first bank statement. Instant insights. Free account. No bank connections.
 </p>
 <Link
 href="/upload"
 className="btn-cta inline-flex items-center gap-3 mt-10 text-lg px-10 py-4"
 >
 Get started
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
 </svg>
 </Link>
 </div>
 </div>
 </div>
 </section>

 {/* Footer */}
 <footer className="relative z-10 py-12 px-6 border-t border-white/5">
 <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
 <span className="font-display text-lg font-bold text-zinc-200">
 Statement<span className="text-amber-400">Reader</span>
 </span>
 <p className="text-xs text-zinc-500">
 Your data stays on your device. Nothing is stored without permission.
 </p>
 </div>
 </footer>
 </div>
 );
}
