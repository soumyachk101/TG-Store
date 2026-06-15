"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { X, Download, ChevronLeft, ChevronRight, FileText, Loader2 } from "lucide-react";
import { streamUrl } from "@/lib/api";
import type { FileItem } from "@/types";
import { formatBytes } from "@/lib/format";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileItem[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export function PreviewModal({ isOpen, onClose, files, currentIndex, onNavigate }: PreviewModalProps) {
  const { data: session } = useSession();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const file = files[currentIndex];

  useEffect(() => {
    if (!isOpen || !file) return;

    let active = true;
    setLoading(true);
    setError(null);

    // Clean up previous URL
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }

    const token = session?.apiToken ?? "";
    const url = streamUrl(file.id);

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load file content");
        return r.blob();
      })
      .then((blob) => {
        if (active) {
          const localUrl = URL.createObjectURL(blob);
          setObjectUrl(localUrl);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Failed to load preview");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [file?.id, isOpen, session?.apiToken]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, currentIndex, files.length]);

  if (!isOpen || !file) return null;

  const handlePrev = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < files.length - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  const handleDownload = () => {
    if (objectUrl) {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      // Fallback if URL isn't loaded yet
      const url = streamUrl(file.id);
      fetch(url, { headers: { Authorization: `Bearer ${session?.apiToken ?? ""}` } })
        .then((r) => r.blob())
        .then((blob) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        });
    }
  };

  const mime = file.mime_type || "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");
  const isPdf = mime === "application/pdf";

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center text-ink-muted">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="mt-2 text-xs">Loading preview...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-danger">
          <p className="text-sm">{error}</p>
          <button onClick={handleDownload} className="mt-4 rounded-full bg-accent hover:bg-accent-hover text-white px-5 py-2 text-xs font-medium active:scale-95 transition-transform">
            Download File
          </button>
        </div>
      );
    }

    if (!objectUrl) return null;

    if (isImage) {
      return (
        <img
          src={objectUrl}
          alt={file.name}
          className="max-h-[80vh] max-w-full rounded object-contain shadow-2xl transition-all duration-300"
        />
      );
    }

    if (isVideo) {
      return (
        <video
          src={objectUrl}
          controls
          autoPlay
          className="max-h-[80vh] max-w-full rounded shadow-2xl focus:outline-none"
        />
      );
    }

    if (isAudio) {
      return (
        <div className="rounded-xl bg-bg-raised p-8 border border-line shadow-2xl flex flex-col items-center gap-4 w-full max-w-md">
          <span className="h-16 w-16 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xl font-bold uppercase">
            {mime.split("/").pop()?.slice(0, 3)}
          </span>
          <div className="text-center">
            <h4 className="text-sm font-semibold text-ink truncate max-w-xs">{file.name}</h4>
            <p className="text-xs text-ink-muted mt-1">{formatBytes(file.size_bytes)}</p>
          </div>
          <audio src={objectUrl} controls autoPlay className="w-full mt-2" />
        </div>
      );
    }

    if (isPdf) {
      return (
        <iframe
          src={`${objectUrl}#toolbar=0`}
          title={file.name}
          className="h-[80vh] w-full max-w-4xl rounded border border-line bg-white shadow-2xl"
        />
      );
    }

    // Default fallback
    return (
      <div className="rounded-xl bg-bg-raised p-8 border border-line shadow-2xl flex flex-col items-center gap-4 text-center max-w-sm">
        <FileText className="h-16 w-16 text-ink-muted stroke-[1.2]" />
        <div>
          <h4 className="text-sm font-semibold text-ink truncate max-w-xs">{file.name}</h4>
          <p className="text-xs text-ink-muted mt-1">{formatBytes(file.size_bytes)}</p>
          <p className="text-[10px] text-ink-faint mt-1 uppercase tracking-wider">{mime}</p>
        </div>
        <button
          onClick={handleDownload}
          className="mt-2 rounded-full bg-accent hover:bg-accent-hover text-white px-5 py-2 text-xs font-medium active:scale-95 transition-transform"
        >
          Download to view
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 transition-opacity duration-300">
      {/* Top Header */}
      <header className="flex h-14 items-center justify-between border-b border-white/10 px-4 text-white">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/75 hover:bg-white/10 hover:text-white active:scale-95 transition-all"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </h2>
            <p className="text-[10px] text-white/50">{formatBytes(file.size_bytes)}</p>
          </div>
        </div>

        <div className="text-xs text-white/60 hidden sm:block">
          {currentIndex + 1} of {files.length}
        </div>

        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-medium hover:bg-white/20 active:scale-95 transition-all text-white"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </button>
      </header>

      {/* Main Preview Container */}
      <div className="relative flex-1 flex items-center justify-center p-4">
        {/* Left Nav Arrow */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 z-10 rounded-full bg-white/5 p-3 hover:bg-white/15 text-white/75 hover:text-white active:scale-95 transition-all"
            aria-label="Previous file"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Dynamic Preview Content */}
        <div className="flex items-center justify-center w-full h-full max-h-[85vh]">
          {renderContent()}
        </div>

        {/* Right Nav Arrow */}
        {currentIndex < files.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 z-10 rounded-full bg-white/5 p-3 hover:bg-white/15 text-white/75 hover:text-white active:scale-95 transition-all"
            aria-label="Next file"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
