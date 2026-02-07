export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-muted/40" />
          <div className="h-4 w-32 rounded bg-muted/30" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-muted/30" />
          <div className="h-9 w-32 rounded-lg bg-muted/40" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
          <div className="h-8 w-64 rounded-md bg-muted/30" />
          <div className="h-8 w-20 rounded-md bg-muted/20" />
          <div className="h-8 w-20 rounded-md bg-muted/20" />
        </div>

        {/* Table header */}
        <div className="flex items-center border-b border-border/40 bg-muted/10 px-4 py-3">
          <div className="h-3 w-4 rounded bg-muted/30 mr-6" />
          <div className="h-3 w-16 rounded bg-muted/30 mr-8" />
          <div className="h-3 w-24 rounded bg-muted/30 mr-8" />
          <div className="h-3 w-32 rounded bg-muted/30 mr-8" />
          <div className="h-3 w-40 rounded bg-muted/30 mr-8" />
          <div className="h-3 w-28 rounded bg-muted/30" />
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center border-b border-border/20 px-4 py-3.5"
            style={{ opacity: 1 - i * 0.08 }}
          >
            <div className="h-4 w-4 rounded bg-muted/25 mr-6" />
            <div className="h-4 w-20 rounded bg-muted/25 mr-8" />
            <div className="h-4 w-28 rounded bg-muted/30 mr-8" />
            <div className="h-4 w-36 rounded bg-muted/25 mr-8" />
            <div className="h-4 w-44 rounded bg-muted/20 mr-8" />
            <div className="h-4 w-24 rounded bg-muted/20" />
          </div>
        ))}
      </div>
    </div>
  );
}
