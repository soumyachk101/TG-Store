"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X as XIcon, MoreHorizontal, Download, Trash2, Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { deleteFile, renameFile, streamUrl } from "@/lib/api";
import type { FileItem } from "@/types";
import { formatBytes, timeAgo } from "@/lib/format";

interface FileRowProps {
  file: FileItem;
}

export function FileRow({ file }: FileRowProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(file.name);
  const [confirming, setConfirming] = useState(false);

  const del = useMutation({
    mutationFn: () => deleteFile(file.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["files"] });
      const prev = queryClient.getQueryData(["files"]) as
        | { pages: Array<{ items: FileItem[]; total: number }> }
        | undefined;
      if (prev) {
        queryClient.setQueryData(["files"], {
          ...prev,
          pages: prev.pages.map((p) => ({
            ...p,
            items: p.items.filter((f) => f.id !== file.id),
            total: Math.max(0, p.total - 1),
          })),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["files"], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const rename = useMutation({
    mutationFn: (name: string) => renameFile(file.id, name),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setDraftName(updated.name);
    },
  });

  function onDownload() {
    const token = session?.apiToken ?? "";
    const url = token ? `${streamUrl(file.id)}?token=${encodeURIComponent(token)}` : streamUrl(file.id);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function onConfirmRename() {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === file.name) {
      setDraftName(file.name);
      setRenaming(false);
      return;
    }
    rename.mutate(trimmed);
    setRenaming(false);
  }

  return (
    <div className="group grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-md border border-transparent px-3 py-2 transition-colors hover:border-line hover:bg-bg-subtle">
      {/* Name (or inline rename) */}
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-bg-raised text-[10px] uppercase text-ink-muted"
          title={file.mime_type ?? ""}
        >
          {(file.mime_type ?? "?").split("/").pop()?.slice(0, 4) ?? "?"}
        </span>
        {renaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirmRename();
                if (e.key === "Escape") {
                  setDraftName(file.name);
                  setRenaming(false);
                }
              }}
              className="min-w-0 flex-1 rounded border border-line bg-bg-raised px-2 py-0.5 text-sm text-ink outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={onConfirmRename}
              className="rounded p-1 text-success hover:bg-bg-raised"
              aria-label="Confirm rename"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftName(file.name);
                setRenaming(false);
              }}
              className="rounded p-1 text-ink-muted hover:bg-bg-raised"
              aria-label="Cancel rename"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="truncate text-sm text-ink" title={file.name}>
            {file.name}
          </span>
        )}
      </div>

      <span className="hidden text-xs tabular-nums text-ink-muted sm:block">
        {formatBytes(file.size_bytes)}
      </span>
      <span className="hidden text-xs text-ink-faint md:block">
        {timeAgo(file.created_at)}
      </span>

      {/* Action menu */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {confirming ? (
          <>
            <button
              onClick={() => {
                del.mutate();
                setConfirming(false);
              }}
              className="rounded bg-danger px-2 py-1 text-xs font-medium text-white hover:brightness-110"
            >
              Delete?
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded px-2 py-1 text-xs text-ink-muted hover:bg-bg-raised"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onDownload}
              title="Download"
              className="rounded p-1.5 text-ink-muted hover:bg-bg-raised hover:text-ink"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setRenaming(true)}
              title="Rename"
              className="rounded p-1.5 text-ink-muted hover:bg-bg-raised hover:text-ink"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirming(true)}
              title="Delete"
              className="rounded p-1.5 text-ink-muted hover:bg-bg-raised hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <span className="rounded p-1.5 text-ink-faint" aria-hidden>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </span>
          </>
        )}
      </div>
    </div>
  );
}
