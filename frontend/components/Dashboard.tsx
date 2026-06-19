"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder,
  File,
  MoreVertical,
  Download,
  Pencil,
  Trash2,
  Move,
  Grid,
  List,
  ChevronRight,
  Eye,
  Loader2,
  UploadCloud,
  FileText,
  Video,
  Music,
  Image as ImageIcon,
  FolderPlus,
  Plus,
  Upload,
  Clock,
  HardDrive,
} from "lucide-react";

import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { listFiles, listFolders, deleteFile, deleteFolder, uploadFile, streamUrl } from "@/lib/api";
import type { FileItem, Folder as FolderItem } from "@/types";
import { formatBytes, timeAgo } from "@/lib/format";
import { NewFolderModal, RenameModal, MoveModal, PendingFilesModal } from "./Modals";
import type { PendingFile } from "./Modals";
import { PreviewModal } from "./PreviewModal";

interface UploadingItem {
  id: string;
  name: string;
  pct: number;
  size: number;
}

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export function Dashboard() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();

  // Active view states
  const [activeTab, setActiveTab] = useState<"drive" | "recent">("drive");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Breadcrumbs stack
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: "My Drive" },
  ]);

  // Uploading status
  const [uploadingItems, setUploadingItems] = useState<UploadingItem[]>([]);

  // Pending files awaiting user confirmation / rename
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);

  // Modals state
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    itemId: string;
    itemType: "file" | "folder";
    name: string;
  }>({ isOpen: false, itemId: "", itemType: "file", name: "" });

  const [moveModal, setMoveModal] = useState<{
    isOpen: boolean;
    fileId: string;
    fileName: string;
  }>({ isOpen: false, fileId: "", fileName: "" });

  // Preview Modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Active dropdown menu item
  const [activeDropdown, setActiveDropdown] = useState<{
    type: "file" | "folder";
    id: string;
  } | null>(null);

  // Refs for triggering the native file picker without relying on a
  // document.querySelector that may match a stale node after re-render.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Monotonic counter for upload IDs — avoids the
  // `Math.random().toString(36).slice(2)` collision risk when several
  // files are dropped in quick succession.
  const uploadIdCounter = useRef(0);
  const nextUploadId = () => {
    uploadIdCounter.current += 1;
    // Combine timestamp + counter for a stable, sortable, collision-free ID.
    return `up-${Date.now().toString(36)}-${uploadIdCounter.current}`;
  };

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      if (search.trim()) {
        setActiveTab("drive"); // Switch back to drive view when searching
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      // Don't hijack shortcuts while a modal is open — typing `n` into
      // the New Folder modal name field would otherwise open another.
      if (previewOpen || newFolderOpen || renameModal.isOpen || moveModal.isOpen) {
        return;
      }
      if (e.key === "u" || e.key === "U") {
        fileInputRef.current?.click();
      } else if (e.key === "n" || e.key === "N") {
        setNewFolderOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen, newFolderOpen, renameModal.isOpen, moveModal.isOpen]);

  // Close mobile dropdown menu on click outside
  useEffect(() => {
    function handleGlobalClick() {
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, [mobileMenuOpen]);

  // Fetch Folders
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ["folders", currentFolderId],
    queryFn: () => listFolders(currentFolderId),
    enabled: status === "authenticated" && activeTab === "drive" && !debouncedSearch,
  });

  // Fetch Files
  const fileParams = React.useMemo(() => {
    if (debouncedSearch) {
      return { search: debouncedSearch, limit: 50 };
    }
    if (activeTab === "recent") {
      return { limit: 50 }; // flat recent files sorted by date
    }
    // drive tab, inside folder or root
    return currentFolderId
      ? { folder_id: currentFolderId, limit: 50 }
      : { root_only: true, limit: 50 };
  }, [activeTab, currentFolderId, debouncedSearch]);

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["files", fileParams],
    queryFn: () => listFiles(fileParams),
    enabled: status === "authenticated",
  });

  const files = filesData?.items ?? [];

  // Folder Mutations
  const folderDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || "Failed to delete folder. Ensure it is empty.");
    },
  });

  // File Mutations
  const fileDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress: (n: number) => void }) =>
      uploadFile({ file, folderId: currentFolderId, onProgress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  // Queue files for the review/rename modal. Files with names that
  // collide with already-pending names get a (1), (2), ... suffix so the
  // backend never sees two files with the same name in the same folder.
  //
  // We compute the new entries against the *current* pending list (read
  // from a ref) instead of putting the work inside a setState updater,
  // because React may run state updaters asynchronously or even call
  // them more than once — so side effects (or even reading .length) on
  // an array built inside the updater would be unreliable.
  const pendingNamesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    pendingNamesRef.current = new Set(pendingFiles.map((p) => p.name));
  }, [pendingFiles]);

  const queueFilesForReview = (incoming: File[]) => {
    const next: PendingFile[] = [];
    for (const file of incoming) {
      if (file.size > MAX_BYTES) {
        alert(`"${file.name}" exceeds 2 GB. Cannot upload.`);
        continue;
      }
      const dot = file.name.lastIndexOf(".");
      const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
      const ext = dot > 0 ? file.name.slice(dot) : "";
      let candidate = file.name;
      let n = 1;
      while (pendingNamesRef.current.has(candidate)) {
        candidate = `${stem} (${n})${ext}`;
        n += 1;
      }
      pendingNamesRef.current.add(candidate);
      next.push({ id: nextUploadId(), file, name: candidate });
    }
    if (next.length > 0) {
      setPendingFiles((cur) => [...cur, ...next]);
      setPendingModalOpen(true);
    }
  };

  // Drag-and-drop handlers
  const onDrop = (acceptedFiles: File[]) => {
    queueFilesForReview(acceptedFiles);
  };

  // Kick off actual uploads of (possibly renamed) File objects. Re-uses
  // the existing upload pipeline so progress, invalidation and error
  // handling stay identical to the pre-rename flow.
  const startPendingUploads = (renamed: File[]) => {
    setPendingModalOpen(false);
    setPendingFiles([]);
    for (const file of renamed) {
      const id = nextUploadId();
      setUploadingItems((cur) => [...cur, { id, name: file.name, pct: 0, size: file.size }]);
      uploadMutation.mutate(
        {
          file,
          onProgress: (pct) =>
            setUploadingItems((cur) => cur.map((i) => (i.id === id ? { ...i, pct } : i))),
        },
        {
          onSettled: () => {
            setTimeout(() => {
              setUploadingItems((cur) => cur.filter((i) => i.id !== id));
            }, 800);
          },
        }
      );
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  });

  // Navigation handlers
  const handleFolderDoubleClick = (folder: FolderItem) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
    setSearch(""); // Clear search when navigating into a folder
  };

  const handleBreadcrumbClick = (idx: number) => {
    const item = breadcrumbs[idx];
    setCurrentFolderId(item.id);
    setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
    setSearch("");
  };

  const handleFileDownload = (file: FileItem) => {
    const url = streamUrl(file.id);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Close dropdown menus when clicking anywhere else
  useEffect(() => {
    function closeMenu() {
      setActiveDropdown(null);
    }
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  // MIME type styling helper
  const getFileIcon = (mime: string | null) => {
    const m = mime || "";
    if (m.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />;
    if (m.startsWith("video/")) return <Video className="h-4 w-4 text-fuchsia-500 shrink-0" />;
    if (m.startsWith("audio/")) return <Music className="h-4 w-4 text-pink-500 shrink-0" />;
    if (m === "application/pdf") return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
    return <File className="h-4 w-4 text-ink-muted shrink-0" />;
  };

  // Sidebar Upload button + "u" shortcut click this. The dropzone-shared
  // <input> ignores programmatic clicks because dropzone nulls out its
  // change handler when noClick is true, so we trigger a *separate*
  // native file input below.
  const pickerInputRef = useRef<HTMLInputElement | null>(null);
  const handleTriggerUpload = () => {
    pickerInputRef.current?.click();
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Copy the files before resetting the input value, because resetting 
    // the value also clears the live FileList object.
    const filesArray = Array.from(files);
    
    // Reset value so picking the same file again re-fires onChange.
    e.target.value = "";
    
    queueFilesForReview(filesArray);
  };

  const isLoading = filesLoading || foldersLoading;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopBar search={search} onSearch={setSearch} />

      <div className="flex flex-1 relative" {...getRootProps()}>
        <input
          {...getInputProps({
            style: {},
            ref: fileInputRef,
          })}
          className="sr-only"
        />

        {/* Separate native file input for the sidebar Upload button.
            We can't reuse the dropzone <input> because dropzone
            installs a null onChange handler when noClick is true. */}
        <input
          ref={pickerInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={handlePickerChange}
        />

        {/* Drag overlay indicator */}
        {isDragActive && (
          <div className="absolute inset-0 bg-accent/10 border-4 border-dashed border-accent z-40 flex flex-col items-center justify-center pointer-events-none backdrop-blur-xs">
            <UploadCloud className="h-16 w-16 text-accent animate-bounce" />
            <h2 className="text-xl font-semibold text-ink mt-4">Drop files to upload here</h2>
            <p className="text-xs text-ink-muted mt-1">Up to 2 GB per file</p>
          </div>
        )}

        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (tab === "recent") {
              setCurrentFolderId(null);
              setBreadcrumbs([{ id: null, name: "My Drive" }]);
            }
          }}
          onNewFolder={() => setNewFolderOpen(true)}
          onUploadClick={handleTriggerUpload}
        />

        {/* Main Panel */}
        <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-3.5rem)] pb-24 md:pb-6">
          {/* Action Row */}
          <div className="flex items-center justify-between border-b border-line pb-4 shrink-0">
            {/* Breadcrumb path */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {debouncedSearch ? (
                <h2 className="text-base font-medium text-ink">
                  Search results for &ldquo;{debouncedSearch}&rdquo;
                </h2>
              ) : activeTab === "recent" ? (
                <h2 className="text-base font-medium text-ink">Recent files</h2>
              ) : (
                breadcrumbs.map((item, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight className="h-4 w-4 text-ink-faint" />}
                    <button
                      onClick={() => handleBreadcrumbClick(idx)}
                      className={`text-base font-medium rounded hover:text-ink transition-colors ${
                        idx === breadcrumbs.length - 1 ? "text-ink font-semibold" : "text-ink-muted"
                      }`}
                    >
                      {item.name}
                    </button>
                  </React.Fragment>
                ))
              )}
            </div>

            {/* View layout Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                className="rounded-full p-2 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-[0.97] transition-[transform,background-color,color] ease-out-expo duration-150"
                title={viewMode === "grid" ? "List view" : "Grid view"}
              >
                {viewMode === "grid" ? <List className="h-4.5 w-4.5" /> : <Grid className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          {/* Loader */}
          {isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          )}

          {/* Core Content Browser */}
          {!isLoading && (
            <div className="flex-1 flex flex-col gap-6">
              {/* Folders section */}
              {activeTab === "drive" && !debouncedSearch && folders.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider select-none">
                    Folders
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {folders.map((f) => (
                      <div
                        key={f.id}
                        onDoubleClick={() => handleFolderDoubleClick(f)}
                        onClick={() => handleFolderDoubleClick(f)} // Fallback for single-click screens
                        className="group relative flex items-center justify-between rounded-xl border border-line bg-bg-raised/40 px-3.5 py-3 hover:border-line-strong hover:bg-bg-raised cursor-pointer select-none transition-[transform,background-color,border-color] ease-out-expo duration-150 active:scale-[0.97]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Folder className="h-5 w-5 text-accent shrink-0 fill-accent/5" />
                          <span className="truncate text-sm font-medium text-ink" title={f.name}>
                            {f.name}
                          </span>
                        </div>

                        {/* Dropdown Options button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdown(
                              activeDropdown?.id === f.id ? null : { type: "folder", id: f.id }
                            );
                          }}
                          className="rounded-full p-1 text-ink-faint hover:bg-bg-subtle hover:text-ink active:scale-[0.97] transition-[transform,background-color,color] ease-out-expo duration-150"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {/* Inline Dropdown menu */}
                        {activeDropdown?.type === "folder" && activeDropdown.id === f.id && (
                          <div className="absolute right-2 top-10 z-40 w-36 rounded-lg border border-line bg-bg-raised p-1 shadow-2xl">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenameModal({
                                  isOpen: true,
                                  itemId: f.id,
                                  itemType: "folder",
                                  name: f.name,
                                });
                                setActiveDropdown(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-ink hover:bg-bg-subtle transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete folder "${f.name}"?`)) {
                                  folderDeleteMutation.mutate(f.id);
                                }
                                setActiveDropdown(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-danger hover:bg-danger/10 transition-colors border-t border-line mt-1 pt-1.5"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files section */}
              {(files.length > 0 || (activeTab === "drive" && folders.length > 0)) && (
                <div className="space-y-3 flex-1 flex flex-col">
                  {files.length > 0 && (
                    <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider select-none shrink-0">
                      Files
                    </h3>
                  )}

                  {files.length === 0 ? (
                    // Folders exist but no files in this view
                    <div className="flex-1" />
                  ) : viewMode === "list" ? (
                    /* LIST VIEW */
                    <div className="overflow-x-auto border border-line bg-bg-raised/20 rounded-xl">
                      <table className="w-full border-collapse text-left text-sm text-ink select-none">
                        <thead>
                          <tr className="border-b border-line text-xs font-semibold text-ink-muted uppercase tracking-wider bg-bg-raised/50">
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium hidden sm:table-cell">Size</th>
                            <th className="px-4 py-3 font-medium hidden md:table-cell">Created</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {files.map((file, fileIdx) => (
                            <tr
                              key={file.id}
                              onClick={() => {
                                if (window.innerWidth < 768) {
                                  setPreviewIndex(fileIdx);
                                  setPreviewOpen(true);
                                }
                              }}
                              onDoubleClick={() => {
                                setPreviewIndex(fileIdx);
                                setPreviewOpen(true);
                              }}
                              className="group border-b border-line last:border-0 hover:bg-bg-raised/45 cursor-pointer transition-colors"
                            >
                              <td className="px-4 py-2.5 font-medium flex items-center gap-3 min-w-0">
                                {getFileIcon(file.mime_type)}
                                <span className="truncate max-w-sm sm:max-w-md" title={file.name}>
                                  {file.name}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-ink-muted tabular-nums hidden sm:table-cell">
                                {formatBytes(file.size_bytes)}
                              </td>
                              <td className="px-4 py-2.5 text-ink-faint hidden md:table-cell">
                                {timeAgo(file.created_at)}
                              </td>
                              <td className="px-4 py-2.5 text-right relative">
                                <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewIndex(fileIdx);
                                      setPreviewOpen(true);
                                    }}
                                    className="rounded-full p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-[0.97] transition-[transform,background-color,color] ease-out-expo duration-150"
                                    title="Preview"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFileDownload(file);
                                    }}
                                    className="rounded-full p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-[0.97] transition-[transform,background-color,color] ease-out-expo duration-150"
                                    title="Download"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdown(
                                        activeDropdown?.id === file.id
                                          ? null
                                          : { type: "file", id: file.id }
                                      );
                                    }}
                                    className="rounded-full p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-[0.97] transition-[transform,background-color,color] ease-out-expo duration-150"
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                {/* File options dropdown */}
                                {activeDropdown?.type === "file" && activeDropdown.id === file.id && (
                                  <div className="absolute right-4 top-10 z-40 w-36 rounded-lg border border-line bg-bg-raised p-1 shadow-2xl text-left">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRenameModal({
                                          isOpen: true,
                                          itemId: file.id,
                                          itemType: "file",
                                          name: file.name,
                                        });
                                        setActiveDropdown(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink hover:bg-bg-subtle transition-colors"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Rename
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMoveModal({
                                          isOpen: true,
                                          fileId: file.id,
                                          fileName: file.name,
                                        });
                                        setActiveDropdown(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink hover:bg-bg-subtle transition-colors"
                                    >
                                      <Move className="h-3.5 w-3.5" />
                                      Move to...
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Delete "${file.name}"?`)) {
                                          fileDeleteMutation.mutate(file.id);
                                        }
                                        setActiveDropdown(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10 transition-colors border-t border-line mt-1 pt-1.5"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* GRID VIEW */
                    <motion.div layout className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      <AnimatePresence mode="popLayout">
                        {files.map((file, fileIdx) => (
                          <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                            key={file.id}
                            onClick={() => {
                              if (window.innerWidth < 768) {
                                setPreviewIndex(fileIdx);
                                setPreviewOpen(true);
                              }
                            }}
                            onDoubleClick={() => {
                              setPreviewIndex(fileIdx);
                              setPreviewOpen(true);
                            }}
                            className="group relative flex flex-col rounded-2xl border border-line bg-bg-raised/30 hover:border-accent/40 hover:bg-bg-raised/60 cursor-pointer select-none transition-[border-color,box-shadow,background-color] ease-out-expo duration-300 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 active:scale-[0.97]"
                          >
                          {/* File Preview Area / Icon Placeholder */}
                          <div className="h-32 bg-bg-subtle/50 flex items-center justify-center relative border-b border-line/40 group-hover:bg-accent/5 transition-colors duration-300">
                            <span className="scale-150 select-none p-5 rounded-full bg-bg border border-line shadow-sm text-ink-muted group-hover:scale-110 group-hover:text-accent group-hover:border-accent/30 transition-[transform,color,border-color] duration-300 ease-out-expo">
                              {getFileIcon(file.mime_type)}
                            </span>

                            {/* Floating overlay quick actions */}
                            <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFileDownload(file);
                                }}
                                className="rounded-full bg-bg/80 backdrop-blur-md p-1.5 text-ink-muted hover:text-ink hover:bg-bg border border-line shadow-sm active:scale-[0.97] transition-[transform,background-color,color] ease-out-expo duration-150"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdown(
                                    activeDropdown?.id === file.id
                                      ? null
                                      : { type: "file", id: file.id }
                                  );
                                }}
                                className="rounded-full bg-bg/80 backdrop-blur-md p-1.5 text-ink-muted hover:text-ink hover:bg-bg border border-line shadow-sm active:scale-[0.97] transition-[transform,background-color,color] ease-out-expo duration-150"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Dropdown in Grid Mode */}
                            {activeDropdown?.type === "file" && activeDropdown.id === file.id && (
                              <div className="absolute right-2 top-10 z-40 w-40 rounded-xl border border-line bg-bg-raised p-1.5 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-150">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenameModal({
                                      isOpen: true,
                                      itemId: file.id,
                                      itemType: "file",
                                      name: file.name,
                                    });
                                    setActiveDropdown(null);
                                  }}
                                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink hover:bg-bg-subtle transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-ink-muted" />
                                  Rename
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMoveModal({
                                      isOpen: true,
                                      fileId: file.id,
                                      fileName: file.name,
                                    });
                                    setActiveDropdown(null);
                                  }}
                                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink hover:bg-bg-subtle transition-colors"
                                >
                                  <Move className="h-3.5 w-3.5 text-ink-muted" />
                                  Move to...
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Delete "${file.name}"?`)) {
                                      fileDeleteMutation.mutate(file.id);
                                    }
                                    setActiveDropdown(null);
                                  }}
                                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-danger hover:bg-danger/10 transition-colors border-t border-line mt-1 pt-2"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>

                          {/* File Details Footer */}
                          <div className="p-3.5 flex flex-col gap-1">
                            <span className="truncate text-sm font-semibold text-ink" title={file.name}>
                              {file.name}
                            </span>
                            <div className="flex justify-between items-center text-[11px] font-medium text-ink-faint">
                              <span className="bg-bg-subtle px-1.5 py-0.5 rounded text-ink-muted">
                                {formatBytes(file.size_bytes)}
                              </span>
                              <span>{timeAgo(file.created_at)}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Empty state (both folder and file lists empty) */}
              {folders.length === 0 && files.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-line/60 rounded-3xl bg-bg-raised/10 m-4 shadow-inner">
                  <div className="h-20 w-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                    <UploadCloud className="h-10 w-10 text-accent animate-pulse" />
                  </div>
                  <h4 className="text-xl font-bold text-ink tracking-tight">
                    {debouncedSearch ? "No files found" : "It's quiet in here..."}
                  </h4>
                  <p className="text-sm text-ink-muted mt-2 max-w-sm leading-relaxed font-medium">
                    {debouncedSearch
                      ? `We couldn't find anything matching "${debouncedSearch}". Try a different keyword.`
                      : "Drag and drop your files anywhere on this page to securely upload them to your private Telegram CDN."}
                  </p>
                  {!debouncedSearch && (
                    <button
                      onClick={handleTriggerUpload}
                      className="mt-8 rounded-full bg-accent hover:bg-accent-hover text-white px-8 py-3.5 text-sm font-semibold active:scale-[0.97] transition-[transform,background-color] ease-out-expo duration-150 shadow-lg shadow-accent/20 flex items-center gap-2"
                    >
                      <Upload className="h-4.5 w-4.5" />
                      Browse Files
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating Uploads Progress Widget */}
      <AnimatePresence>
        {uploadingItems.length > 0 && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-4 right-4 z-50 w-80 space-y-2 rounded-xl border border-line bg-bg-raised p-4 shadow-2xl select-none"
          >
          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted border-b border-line pb-2 mb-2">
            <span>Uploading {uploadingItems.length} {uploadingItems.length === 1 ? "item" : "items"}</span>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-3 pr-1">
            {uploadingItems.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="truncate text-xs font-medium text-ink" title={item.name}>
                    {item.name}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-ink-muted">
                    {item.pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full bg-accent transition-[width] duration-150 rounded-full"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Overlays */}
      <NewFolderModal
        isOpen={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        parentId={currentFolderId}
      />

      <PendingFilesModal
        isOpen={pendingModalOpen}
        onClose={() => {
          setPendingModalOpen(false);
          setPendingFiles([]);
        }}
        files={pendingFiles}
        onUpdateName={(id, name) =>
          setPendingFiles((cur) => cur.map((p) => (p.id === id ? { ...p, name } : p)))
        }
        onRemove={(id) =>
          setPendingFiles((cur) => cur.filter((p) => p.id !== id))
        }
        onStartUpload={startPendingUploads}
      />

      <RenameModal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal({ ...renameModal, isOpen: false })}
        itemId={renameModal.itemId}
        itemType={renameModal.itemType}
        initialName={renameModal.name}
      />

      <MoveModal
        isOpen={moveModal.isOpen}
        onClose={() => setMoveModal({ ...moveModal, isOpen: false })}
        fileId={moveModal.fileId}
        fileName={moveModal.fileName}
        currentFolderId={currentFolderId}
      />

      <PreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        files={files}
        currentIndex={previewIndex}
        onNavigate={(idx) => setPreviewIndex(idx)}
      />

      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 h-16 bg-bg-raised/90 border-t border-line backdrop-blur-md flex md:hidden items-center justify-around px-4 shadow-lg pb-safe">
        {/* Drive Tab */}
        <button
          onClick={() => {
            setActiveTab("drive");
            setCurrentFolderId(null);
            setBreadcrumbs([{ id: null, name: "My Drive" }]);
          }}
          className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors ${
            activeTab === "drive" && !debouncedSearch ? "text-accent" : "text-ink-muted hover:text-ink"
          }`}
        >
          <HardDrive className="h-5 w-5" />
          <span className="text-[10px] font-medium font-sans">Drive</span>
        </button>

        {/* Plus Button in the middle */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            className="flex items-center justify-center h-12 w-12 rounded-full bg-accent text-white shadow-lg hover:bg-accent-hover active:scale-95 transition-all duration-100 -translate-y-2 border-4 border-bg"
            aria-label="New item"
          >
            <Plus className={`h-6 w-6 transition-transform duration-200 ${mobileMenuOpen ? "rotate-45" : ""}`} />
          </button>

          {mobileMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 w-48 rounded-xl border border-line bg-bg-raised p-1.5 shadow-2xl origin-bottom animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              <button
                onClick={() => {
                  setNewFolderOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-bg-subtle transition-colors active:scale-[0.98]"
              >
                <FolderPlus className="h-4 w-4 text-accent" />
                New folder
              </button>
              <button
                onClick={() => {
                  handleTriggerUpload();
                  setTimeout(() => {
                    setMobileMenuOpen(false);
                  }, 100);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-bg-subtle transition-colors active:scale-[0.98] border-t border-line mt-1 pt-2"
              >
                <Upload className="h-4 w-4 text-accent" />
                File upload
              </button>
            </div>
          )}
        </div>

        {/* Recent Tab */}
        <button
          onClick={() => {
            setActiveTab("recent");
            setCurrentFolderId(null);
            setBreadcrumbs([{ id: null, name: "My Drive" }]);
          }}
          className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors ${
            activeTab === "recent" ? "text-accent" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Clock className="h-5 w-5" />
          <span className="text-[10px] font-medium font-sans">Recent</span>
        </button>
      </div>
    </div>
  );
}
