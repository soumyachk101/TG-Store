"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { uploadFile } from "@/lib/api";

interface UploadDropzoneProps {
  /** Optional target folder — null = root. */
  folderId?: string | null;
}

interface UploadingItem {
  id: string;
  name: string;
  pct: number;
  size: number;
}

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export function UploadDropzone({ folderId }: UploadDropzoneProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadingItem[]>([]);

  const mutation = useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress: (n: number) => void }) =>
      uploadFile({ file, folderId, onProgress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const onDrop = (files: File[]) => {
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        alert(`"${file.name}" is too large. Max 2 GB.`);
        continue;
      }
      const id = crypto.randomUUID();
      setItems((cur) => [...cur, { id, name: file.name, pct: 0, size: file.size }]);
      mutation.mutate(
        {
          file,
          onProgress: (pct) =>
            setItems((cur) => cur.map((i) => (i.id === id ? { ...i, pct } : i))),
        },
        {
          onSettled: () => {
            // Keep visible briefly so the user sees 100%, then clear
            setTimeout(() => {
              setItems((cur) => cur.filter((i) => i.id !== id));
            }, 800);
          },
        }
      );
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  return (
    <>
      <div
        {...getRootProps()}
        className={[
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
          isDragActive ? "border-accent bg-accent/5" : "border-line hover:border-line-strong",
        ].join(" ")}
      >
        <input {...getInputProps()} />
        <Upload className="h-5 w-5 text-ink-muted" />
        <p className="mt-2 text-sm text-ink-muted">
          {isDragActive ? "Drop to upload" : "Drag files here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-ink-faint">Up to 2 GB per file</p>
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-80 space-y-2 rounded-lg border border-line bg-bg-raised p-3 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Uploads</span>
            <span>{items.length}</span>
          </div>
          {items.map((it) => (
            <div key={it.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-ink">{it.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                  {it.pct}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full bg-accent transition-[width] duration-150"
                  style={{ width: `${it.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
