"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useDropzone } from "react-dropzone";
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
} from "lucide-react";

import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { listFiles, listFolders, deleteFile, deleteFolder, uploadFile, streamUrl } from "@/lib/api";
import type { FileItem, Folder as FolderItem } from "@/types";
import { formatBytes, timeAgo } from "@/lib/format";
import { NewFolderModal, RenameModal, MoveModal } from "./Modals";
import { PreviewModal } from "./PreviewModal";

interface UploadingItem {
  id: string;
  name: string;
  pct: number;
  size: number;
}

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export function Dashboard() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // Active view states
  const [activeTab, setActiveTab] = useState<"drive" | "recent">("drive");
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
      if (e.key === "u" || e.key === "U") {
        document.querySelector<HTMLInputElement>('input[type="file"]')?.click();
      } else if (e.key === "n" || e.key === "N") {
        setNewFolderOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch Folders
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ["folders", currentFolderId],
    queryFn: () => listFolders(currentFolderId),
    enabled: activeTab === "drive" && !debouncedSearch,
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

  // Drag-and-drop handlers
  const onDrop = (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      if (file.size > MAX_BYTES) {
        alert(`"${file.name}" exceeds 2 GB. Cannot upload.`);
        continue;
      }
      const id = crypto.randomUUID();
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
    const token = session?.apiToken ?? "";
    const url = token ? `${streamUrl(file.id)}?token=${encodeURIComponent(token)}` : streamUrl(file.id);
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

  const handleTriggerUpload = () => {
    document.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  };

  const isLoading = filesLoading || foldersLoading;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopBar search={search} onSearch={setSearch} />

      <div className="flex flex-1 relative" {...getRootProps()}>
        <input {...getInputProps()} />

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
        <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
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
                className="rounded-full p-2 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-all"
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
                        className="group relative flex items-center justify-between rounded-xl border border-line bg-bg-raised/40 px-3.5 py-3 hover:border-line-strong hover:bg-bg-raised cursor-pointer select-none transition-all duration-150 active:scale-[0.98]"
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
                          className="rounded-full p-1 text-ink-faint hover:bg-bg-subtle hover:text-ink active:scale-95 transition-all"
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
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewIndex(fileIdx);
                                      setPreviewOpen(true);
                                    }}
                                    className="rounded-full p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-all"
                                    title="Preview"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFileDownload(file);
                                    }}
                                    className="rounded-full p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-all"
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
                                    className="rounded-full p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-all"
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
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {files.map((file, fileIdx) => (
                        <div
                          key={file.id}
                          onDoubleClick={() => {
                            setPreviewIndex(fileIdx);
                            setPreviewOpen(true);
                          }}
                          className="group relative flex flex-col rounded-xl border border-line bg-bg-raised/20 hover:border-line-strong hover:bg-bg-raised/40 cursor-pointer select-none transition-all duration-150 overflow-hidden shadow-xs hover:shadow-md"
                        >
                          {/* File Preview Area / Icon Placeholder */}
                          <div className="h-28 bg-bg-raised/50 flex items-center justify-center relative border-b border-line/40 group-hover:bg-bg-subtle/30 transition-colors">
                            <span className="scale-125 select-none p-4 rounded-full bg-bg/40 border border-line/50 text-ink-muted">
                              {getFileIcon(file.mime_type)}
                            </span>

                            {/* Floating overlay quick actions */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFileDownload(file);
                                }}
                                className="rounded-full bg-bg p-1.5 text-ink-muted hover:text-ink border border-line shadow-sm active:scale-95 transition-all"
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
                                className="rounded-full bg-bg p-1.5 text-ink-muted hover:text-ink border border-line shadow-sm active:scale-95 transition-all"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Dropdown in Grid Mode */}
                            {activeDropdown?.type === "file" && activeDropdown.id === file.id && (
                              <div className="absolute right-2 top-10 z-40 w-36 rounded-lg border border-line bg-bg-raised p-1 shadow-2xl text-left">
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
                          </div>

                          {/* File Details Footer */}
                          <div className="p-3 flex flex-col gap-0.5">
                            <span className="truncate text-xs font-semibold text-ink" title={file.name}>
                              {file.name}
                            </span>
                            <div className="flex justify-between items-center text-[10px] text-ink-faint">
                              <span>{formatBytes(file.size_bytes)}</span>
                              <span>{timeAgo(file.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state (both folder and file lists empty) */}
              {folders.length === 0 && files.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border border-dashed border-line rounded-2xl bg-bg-raised/10">
                  <UploadCloud className="h-12 w-12 text-ink-faint stroke-[1.2]" />
                  <h4 className="text-sm font-semibold text-ink mt-4">
                    {debouncedSearch ? "No files found" : "This folder is empty"}
                  </h4>
                  <p className="text-xs text-ink-muted mt-1 max-w-xs leading-relaxed">
                    {debouncedSearch
                      ? `No results matched "${debouncedSearch}". Try search keywords.`
                      : "Drag and drop files onto the dashboard to upload them to this location."}
                  </p>
                  {!debouncedSearch && (
                    <button
                      onClick={handleTriggerUpload}
                      className="mt-5 rounded-full bg-accent hover:bg-accent-hover text-white px-5 py-2.5 text-xs font-medium active:scale-95 transition-transform shadow-md"
                    >
                      Upload Files
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating Uploads Progress Widget */}
      {uploadingItems.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-80 space-y-2 rounded-xl border border-line bg-bg-raised p-4 shadow-2xl select-none animate-in fade-in slide-in-from-bottom-4 duration-300">
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
        </div>
      )}

      {/* Interactive Overlays */}
      <NewFolderModal
        isOpen={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        parentId={currentFolderId}
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
    </div>
  );
}
