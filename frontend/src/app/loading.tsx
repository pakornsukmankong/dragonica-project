// Shown instantly during route transitions (App Router Suspense fallback),
// so navigation feels responsive instead of frozen while the next page loads.
export default function Loading() {
  return (
    <main className="min-h-screen bg-root">
      <section className="py-[60px] laptop:py-[90px]">
        <div className="mx-auto max-w-container px-4 sm:px-7">
          {/* Header */}
          <div className="mb-10 space-y-3">
            <div className="h-7 w-48 rounded-base bg-raised animate-pulse" />
            <div className="h-4 w-72 rounded-base bg-raised animate-pulse" />
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 laptop:grid-cols-3 desktop:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-base bg-surface outline outline-1 outline-[rgba(255,255,255,0.08)] animate-pulse"
              />
            ))}
          </div>

          {/* Panel */}
          <div className="mt-10 h-64 rounded-base bg-surface outline outline-1 outline-[rgba(255,255,255,0.08)] animate-pulse" />
        </div>
      </section>
    </main>
  );
}
