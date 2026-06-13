"use client";

import { useQuery } from "@tanstack/react-query";
import { listFiles } from "@/lib/api";
import type { FileListParams } from "@/types";
import { FileRow } from "./FileRow";

interface FileListProps {
  params: FileListParams;
}

export function FileList({ params }: FileListProps) {
  const q = useQuery({
    queryKey: ["files", params],
    queryFn: () => listFiles(params),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-md border border-line bg-bg-subtle"
          />
        ))}
      </div>
    );
  }

  if (q.error) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
        Failed to load files.{" "}
        <button onClick={() => q.refetch()} className="underline">
          Retry
        </button>
      </div>
    );
  }

  const items = q.data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line p-10 text-center text-sm text-ink-muted">
        {params.search
          ? `No files match “${params.search}”`
          : "No files yet. Drop something above to get started."}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((f) => (
        <FileRow key={f.id} file={f} />
      ))}
      {q.data?.has_next && (
        <div className="pt-3 text-center">
          <button
            className="text-xs text-ink-muted underline-offset-2 hover:underline"
            disabled
            title="Pagination is on the roadmap"
          >
            Load more…
          </button>
        </div>
      )}
    </div>
  );
}
