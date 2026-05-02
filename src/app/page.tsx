import Link from "next/link";

export default function Home() {
  return (
    <>
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-semibold text-amber-700 dark:text-amber-500 tracking-tight">
            Statement Reader
          </span>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            Try it free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="animate-fade-up font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] text-warm-black dark:text-warm-white">
            Your bank statements,
            <br />
            <span className="text-amber-600 dark:text-amber-500">finally understood.</span>
          </h1>
          <p className="animate-fade-up animate-stagger-1 mt-8 text-lg sm:text-xl text-warm-black/60 dark:text-warm-white/50 max-w-2xl mx-auto leading-relaxed">
            Upload any bank statement — PDF or CSV — and get instant clarity on your cash flow,
            spending patterns, and a personalised financial forecast. No bank connections needed.
          </p>
          <div className="animate-fade-up animate-stagger-2 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-amber-500 text-white font-medium text-lg hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
            >
              Upload a statement
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <span className="text-sm text-warm-black/40 dark:text-warm-white/30">
              Free. No sign-up.
            </span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-warm-gray/30 dark:bg-warm-black/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center text-warm-black dark:text-warm-white mb-16">
            Three steps to clarity
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
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
                className="animate-fade-up glass rounded-2xl p-8 flex flex-col gap-4"
                style={{ animationDelay: `${i * 0.15}s`, opacity: 0 }}
              >
                <span className="font-mono text-xs text-amber-600 dark:text-amber-500 tracking-widest">
                  {item.step}
                </span>
                <h3 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white">
                  {item.title}
                </h3>
                <p className="text-warm-black/55 dark:text-warm-white/40 leading-relaxed text-sm">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center text-warm-black dark:text-warm-white mb-16">
            Everything you need
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: "Cash flow timeline",
                desc: "See exactly how money moves in and out across months. Spot trends before they become problems.",
              },
              {
                title: "Smart categorisation",
                desc: "Every transaction is automatically sorted into categories — groceries, rent, entertainment, and more.",
              },
              {
                title: "Monthly forecast",
                desc: "AI predicts your next month's financial position based on your actual spending patterns.",
              },
              {
                title: "Spending breakdown",
                desc: "Understand where your money goes with visual category breakdowns and percentage analysis.",
              },
              {
                title: "Unusual activity flags",
                desc: "Get alerted to transactions that don't fit your normal pattern — catch issues early.",
              },
              {
                title: "Savings opportunities",
                desc: "Concrete, personalised recommendations for where you could save, based on your real data.",
              },
            ].map((f, i) => (
              <div
                key={f.title}
                className="animate-fade-up flex gap-4 p-6 rounded-xl"
                style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}
              >
                <div>
                  <h3 className="font-display text-lg font-semibold text-warm-black dark:text-warm-white">
                    {f.title}
                  </h3>
                  <p className="mt-1 text-sm text-warm-black/50 dark:text-warm-white/40 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass rounded-3xl p-12 sm:p-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-warm-black dark:text-warm-white">
              Ready to understand your money?
            </h2>
            <p className="mt-4 text-warm-black/55 dark:text-warm-white/40 max-w-md mx-auto">
              Upload your first bank statement. Instant insights. No sign-up. No bank connections.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 mt-8 px-8 py-3.5 rounded-full bg-amber-500 text-white font-medium text-lg hover:bg-amber-600 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-warm-gray/50 dark:border-warm-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display text-lg font-semibold text-amber-700 dark:text-amber-500">
            Statement Reader
          </span>
          <p className="text-xs text-warm-black/30 dark:text-warm-white/20">
            Your data stays on your device. Nothing is stored without permission.
          </p>
        </div>
      </footer>
    </>
  );
}
