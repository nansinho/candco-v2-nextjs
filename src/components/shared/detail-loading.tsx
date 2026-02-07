export function DetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back button + title */}
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 rounded-lg bg-muted/30" />
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-7 w-56 rounded-lg bg-muted/40" />
            <div className="h-5 w-16 rounded-full bg-muted/30" />
          </div>
          <div className="h-3.5 w-40 rounded bg-muted/20" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <div className="h-8 w-20 rounded-md bg-muted/25" />
        <div className="h-8 w-20 rounded-md bg-muted/25" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/40 pb-px">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-8 rounded-md bg-muted/25 px-4"
            style={{ width: `${80 + i * 20}px` }}
          />
        ))}
      </div>

      {/* Content card */}
      <div className="rounded-lg border border-border/60 bg-card p-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-muted/30" />
              <div className="h-9 w-full rounded-md bg-muted/20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
