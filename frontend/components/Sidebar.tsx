"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { FolderPlus, Upload, HardDrive, Clock, Plus, HelpCircle } from "lucide-react";
import Link from "next/link";
import { getStats } from "@/lib/api";
import { formatBytes } from "@/lib/format";

interface SidebarProps {
  activeTab: "drive" | "recent";
  setActiveTab: (tab: "drive" | "recent") => void;
  onNewFolder: () => void;
  onUploadClick: () => void;
}

const MOCK_TOTAL_CAPACITY = 15 * 1024 * 1024 * 1024; // 15 GB free tier representation

export function Sidebar({ activeTab, setActiveTab, onNewFolder, onUploadClick }: SidebarProps) {
  const { status } = useSession();
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    enabled: status === "authenticated",
  });

  // Close "+ New" dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalUsed = stats?.total_size ?? 0;
  const totalFiles = stats?.total_count ?? 0;
  const usePercentage = Math.min(100, (totalUsed / MOCK_TOTAL_CAPACITY) * 100);

  return (
    <aside className="w-64 border-r border-line bg-bg/50 p-4 flex flex-col gap-6 shrink-0 h-[calc(100vh-3rem)] sticky top-12 hidden md:flex">
      {/* "+ New" Dropdown Button */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setNewMenuOpen(!newMenuOpen)}
          className="flex items-center gap-3 rounded-2xl bg-bg-raised border border-line px-6 py-4 shadow-md hover:shadow-lg text-ink font-medium text-sm transition-all hover:bg-bg-subtle active:scale-95 duration-150"
        >
          <Plus className="h-5 w-5 text-accent animate-pulse" />
          <span>New</span>
        </button>

        {newMenuOpen && (
          <div className="absolute left-0 mt-2 z-40 w-56 rounded-xl border border-line bg-bg-raised p-1.5 shadow-2xl scale-100 transition-all origin-top-left">
            <button
              onClick={() => {
                onNewFolder();
                setNewMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-bg-subtle transition-colors active:scale-[0.98]"
            >
              <FolderPlus className="h-4 w-4 text-accent" />
              New folder
            </button>
            <button
              onClick={() => {
                onUploadClick();
                setNewMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-bg-subtle transition-colors active:scale-[0.98] border-t border-line mt-1 pt-2"
            >
              <Upload className="h-4 w-4 text-accent" />
              File upload
            </button>
          </div>
        )}
      </div>

      {/* Navigation Options */}
      <nav className="flex flex-col gap-1">
        <button
          onClick={() => setActiveTab("drive")}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-left transition-all ${
            activeTab === "drive"
              ? "bg-accent/15 text-accent"
              : "text-ink-muted hover:bg-bg-subtle hover:text-ink"
          }`}
        >
          <HardDrive className={`h-4.5 w-4.5 ${activeTab === "drive" ? "text-accent" : "text-ink-muted"}`} />
          <span>My Drive</span>
        </button>
        <button
          onClick={() => setActiveTab("recent")}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-left transition-all ${
            activeTab === "recent"
              ? "bg-accent/15 text-accent"
              : "text-ink-muted hover:bg-bg-subtle hover:text-ink"
          }`}
        >
          <Clock className={`h-4.5 w-4.5 ${activeTab === "recent" ? "text-accent" : "text-ink-muted"}`} />
          <span>Recent</span>
        </button>
      </nav>

      {/* Storage stats section */}
      <div className="mt-auto border-t border-line pt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-ink-muted text-xs">
          <HardDrive className="h-4 w-4" />
          <span>Storage</span>
        </div>

        <div>
          <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-500 rounded-full"
              style={{ width: `${usePercentage}%` }}
            />
          </div>
          <div className="flex justify-between items-baseline mt-1.5">
            <span className="text-xs text-ink">
              {formatBytes(totalUsed)}
            </span>
            <span className="text-[10px] text-ink-faint">
              of {formatBytes(MOCK_TOTAL_CAPACITY)} used
            </span>
          </div>
        </div>

        <div className="text-[10px] text-ink-faint leading-relaxed bg-bg-raised p-2.5 rounded-lg border border-line flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 font-medium text-ink-muted">
            <HelpCircle className="h-3 w-3 text-accent" />
            <span>Infrastructure Info</span>
          </div>
          <span>Free CDN powered by Telegram. Files up to 2 GB are indexed in PostgreSQL.</span>
          <div className="border-t border-line/50 pt-1.5 mt-0.5 flex flex-col gap-1 text-[9px] text-ink-faint/80">
            <span>Developed by <span className="font-semibold text-accent/90 cursor-default">Soumya Chakraborty</span></span>
            <div className="flex gap-2">
              <Link href="/terms" className="hover:text-ink transition-colors">Terms</Link>
              <span>•</span>
              <Link href="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
              <span>•</span>
              <Link href="/disclaimer" className="hover:text-ink transition-colors">Disclaimer</Link>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
