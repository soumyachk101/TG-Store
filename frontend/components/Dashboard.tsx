"use client";

import { useEffect } from "react";
import { TopBar } from "./TopBar";
import { UploadDropzone } from "./UploadDropzone";
import { FileList } from "./FileList";
import { StorageStats } from "./StorageStats";
import { ApiAuthBridge } from "./ApiAuthBridge";
import { useState } from "react";

/** Dashboard shell — owns the search query and folder context. */
export function Dashboard() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce 300ms (per Docs/APP FLOW.md §6)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Keyboard shortcuts (per Docs/APP FLOW.md §9)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "u" || e.key === "U") {
        document.querySelector<HTMLInputElement>('input[type="file"]')?.click();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ApiAuthBridge>
      <div className="flex min-h-screen flex-col">
        <TopBar search={search} onSearch={setSearch} />
        <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_280px]">
          <section className="space-y-4">
            <UploadDropzone folderId={null} />
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-ink-muted">
                {debounced ? `Results for “${debounced}”` : "All files"}
              </h2>
            </div>
            <FileList params={{ search: debounced || undefined, limit: 50 }} />
          </section>
          <aside>
            <StorageStats />
          </aside>
        </main>
      </div>
    </ApiAuthBridge>
  );
}
