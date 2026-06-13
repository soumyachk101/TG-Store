"use client";

import { useQuery } from "@tanstack/react-query";
import { getStats } from "@/lib/api";
import { formatBytes } from "@/lib/format";

const COLORS: Record<string, string> = {
  Images: "bg-accent",
  Videos: "bg-fuchsia-500",
  Audio: "bg-emerald-500",
  Documents: "bg-amber-500",
  Other: "bg-ink-faint",
};

export function StorageStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
  });

  if (isLoading || !data) {
    return (
      <div className="h-40 animate-pulse rounded-md border border-line bg-bg-subtle" />
    );
  }

  const total = Math.max(1, data.total_size);

  return (
    <div className="rounded-md border border-line bg-bg-subtle p-4">
      <h3 className="text-sm font-medium text-ink">Storage</h3>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-2xl font-semibold tabular-nums text-ink">
          {formatBytes(data.total_size)}
        </span>
        <span className="text-xs text-ink-muted">
          · {data.total_count} file{data.total_count === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
        {data.by_type.map((t) => {
          if (t.size === 0) return null;
          const pct = (t.size / total) * 100;
          return (
            <div
              key={t.mime_group}
              className={["inline-block h-full", COLORS[t.mime_group] ?? "bg-ink-faint"].join(" ")}
              style={{ width: `${pct}%` }}
              title={`${t.mime_group}: ${formatBytes(t.size)}`}
            />
          );
        })}
      </div>

      <ul className="mt-3 space-y-1.5">
        {data.by_type.map((t) => {
          const pct = data.total_size ? (t.size / data.total_size) * 100 : 0;
          return (
            <li key={t.mime_group} className="flex items-center gap-2 text-xs">
              <span
                className={[
                  "h-2 w-2 shrink-0 rounded-sm",
                  COLORS[t.mime_group] ?? "bg-ink-faint",
                ].join(" ")}
              />
              <span className="w-20 text-ink-muted">{t.mime_group}</span>
              <span className="flex-1 text-ink-faint">
                {pct.toFixed(0)}%
              </span>
              <span className="tabular-nums text-ink-muted">{formatBytes(t.size)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
