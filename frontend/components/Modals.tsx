"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Folder, ChevronRight, FolderPlus, ArrowLeft, File as FileIcon, Trash2, Upload as UploadIcon } from "lucide-react";
import { createFolder, renameFile, renameFolder, moveFile, listFolders } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string | null;
}

export function NewFolderModal({ isOpen, onClose, parentId }: NewFolderModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (folderName: string) => createFolder(folderName, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      onClose();
      setName("");
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || "Failed to create folder. Please try again.");
    },
  });

  useEffect(() => {
    if (isOpen) {
      setName("");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      setError(null);
      mutation.mutate(trimmed);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-2xl border border-line bg-bg-raised p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="text-lg font-medium text-ink">New folder</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-transform"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <input
            autoFocus
            type="text"
            placeholder="Untitled folder"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />

          {error && (
            <div className="mt-3 text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg p-2.5 leading-normal">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs font-medium text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-transform"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !name.trim()}
              className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50 active:scale-95 transition-all"
            >
              {mutation.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: "file" | "folder";
  initialName: string;
}

export function RenameModal({ isOpen, onClose, itemId, itemType, initialName }: RenameModalProps) {
  const [name, setName] = useState(initialName);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) setName(initialName);
  }, [isOpen, initialName]);

  const mutation = useMutation<any, Error, string>({
    mutationFn: (newName: string) => {
      if (itemType === "file") {
        return renameFile(itemId, newName);
      } else {
        return renameFolder(itemId, newName);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== initialName) {
      mutation.mutate(trimmed);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-2xl border border-line bg-bg-raised p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="text-lg font-medium text-ink">Rename</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-transform"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-4 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs font-medium text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-transform"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !name.trim() || name.trim() === initialName}
              className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50 active:scale-95 transition-all"
            >
              {mutation.isPending ? "Renaming..." : "OK"}
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  currentFolderId: string | null;
}

export function MoveModal({ isOpen, onClose, fileId, fileName, currentFolderId }: MoveModalProps) {
  // Navigation stack inside the modal to browse folders
  const [navStack, setNavStack] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: "My Drive" },
  ]);
  const activeFolder = navStack[navStack.length - 1];
  const queryClient = useQueryClient();

  const { data: subFolders, isLoading } = useQuery({
    queryKey: ["modal-folders", activeFolder.id],
    queryFn: () => listFolders(activeFolder.id),
    enabled: isOpen,
  });

  const moveMutation = useMutation({
    mutationFn: (targetFolderId: string | null) => moveFile(fileId, targetFolderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen) {
      // Start in My Drive or currentFolder (if any)
      setNavStack([{ id: null, name: "My Drive" }]);
    }
  }, [isOpen]);

  const navigateTo = (id: string, name: string) => {
    setNavStack([...navStack, { id, name }]);
  };

  const navigateBack = () => {
    if (navStack.length > 1) {
      setNavStack(navStack.slice(0, -1));
    }
  };

  const handleMove = () => {
    moveMutation.mutate(activeFolder.id);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-2xl border border-line bg-bg-raised p-6 shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between border-b border-line pb-3 shrink-0">
          <div>
            <h3 className="text-lg font-medium text-ink">Move &ldquo;{fileName}&rdquo;</h3>
            <p className="text-xs text-ink-muted mt-0.5">Choose target location</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-transform"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Breadcrumb inside Modal */}
        <div className="flex items-center gap-1 py-3 px-1 text-xs border-b border-line shrink-0 overflow-x-auto whitespace-nowrap">
          {navStack.length > 1 && (
            <button
              onClick={navigateBack}
              className="mr-1 rounded p-1 hover:bg-bg-subtle text-ink-muted hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
          {navStack.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="h-3 w-3 text-ink-faint shrink-0" />}
              <button
                onClick={() => setNavStack(navStack.slice(0, idx + 1))}
                className={`truncate max-w-[100px] hover:underline ${
                  idx === navStack.length - 1 ? "text-accent font-medium" : "text-ink-muted"
                }`}
              >
                {item.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Folder List Container */}
        <div className="flex-1 overflow-y-auto py-2 min-h-[200px]">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-bg-subtle" />
              ))}
            </div>
          ) : subFolders && subFolders.length > 0 ? (
            <div className="space-y-0.5">
              {subFolders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => navigateTo(f.id, f.name)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-bg-subtle text-left text-sm text-ink group transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Folder className="h-4.5 w-4.5 text-accent shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderPlus className="h-8 w-8 text-ink-faint stroke-[1.5]" />
              <p className="mt-2 text-xs text-ink-muted">No folders inside</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-4 flex justify-between gap-3 border-t border-line pt-4 shrink-0">
          <span className="text-xs text-ink-muted self-center truncate max-w-[200px]">
            Target: <span className="font-semibold text-ink">{activeFolder.name}</span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs font-medium text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-transform"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMove}
              disabled={moveMutation.isPending || activeFolder.id === currentFolderId}
              className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50 active:scale-95 transition-all"
            >
              {moveMutation.isPending ? "Moving..." : "Move Here"}
            </button>
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface PendingFile {
  id: string;
  file: File;
  name: string;
}

interface PendingFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: PendingFile[];
  onUpdateName: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onStartUpload: (files: File[]) => void;
}

const FORBIDDEN_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001F]/g;
const MAX_NAME_LENGTH = 255;

function splitName(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) {
    return { stem: name, ext: "" };
  }
  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

export function PendingFilesModal({
  isOpen,
  onClose,
  files,
  onUpdateName,
  onRemove,
  onStartUpload,
}: PendingFilesModalProps) {
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (isOpen) {
      setErrors({});
    }
  }, [isOpen]);

  const handleNameChange = (id: string, value: string) => {
    onUpdateName(id, value);
    if (errors[id]) {
      setErrors((cur) => ({ ...cur, [id]: null }));
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string | null> = {};
    let ok = true;
    for (const f of files) {
      const trimmed = f.name.trim();
      if (!trimmed) {
        next[f.id] = "Name cannot be empty.";
        ok = false;
        continue;
      }
      if (trimmed.length > MAX_NAME_LENGTH) {
        next[f.id] = `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
        ok = false;
        continue;
      }
      if (FORBIDDEN_NAME_CHARS.test(trimmed)) {
        next[f.id] = "Name contains invalid characters.";
        ok = false;
        continue;
      }
    }
    setErrors(next);
    return ok;
  };

  const handleUpload = () => {
    if (!validate()) return;
    const renamed: File[] = files.map((f) => {
      const finalName = f.name.trim();
      if (finalName === f.file.name) return f.file;
      return new File([f.file], finalName, {
        type: f.file.type,
        lastModified: f.file.lastModified,
      });
    });
    onStartUpload(renamed);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-lg rounded-2xl border border-line bg-bg-raised p-6 shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between border-b border-line pb-3 shrink-0">
              <div>
                <h3 className="text-lg font-medium text-ink">Review files</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Rename before uploading. {files.length}{" "}
                  {files.length === 1 ? "file" : "files"} selected.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-transform"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2 min-h-[120px]">
              {files.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FileIcon className="h-8 w-8 text-ink-faint stroke-[1.5]" />
                  <p className="mt-2 text-xs text-ink-muted">No files selected</p>
                </div>
              )}
              {files.map((f) => {
                const { ext } = splitName(f.file.name);
                return (
                  <div
                    key={f.id}
                    className="rounded-lg border border-line bg-bg p-3 transition-colors focus-within:border-accent"
                  >
                    <div className="flex items-center gap-2">
                      <FileIcon className="h-4 w-4 text-ink-muted shrink-0" />
                      <input
                        type="text"
                        value={f.name}
                        onChange={(e) => handleNameChange(f.id, e.target.value)}
                        aria-label={`Name for ${f.file.name}`}
                        spellCheck={false}
                        className="flex-1 min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-ink placeholder:text-ink-faint focus:border-line focus:bg-bg-raised focus:outline-none"
                        placeholder={f.file.name}
                      />
                      {ext && (
                        <span
                          className="shrink-0 rounded-md bg-bg-subtle px-1.5 py-0.5 text-[10px] font-mono text-ink-muted"
                          title={`Original extension: ${ext}`}
                        >
                          {ext}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemove(f.id)}
                        aria-label={`Remove ${f.file.name}`}
                        className="shrink-0 rounded-full p-1.5 text-ink-muted hover:bg-danger/10 hover:text-danger active:scale-95 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {errors[f.id] && (
                      <p className="mt-1 ml-6 text-[11px] text-danger">{errors[f.id]}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex justify-end gap-3 border-t border-line pt-4 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2 text-xs font-medium text-ink-muted hover:bg-bg-subtle hover:text-ink active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={files.length === 0}
                className="flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50 active:scale-95 transition-all"
              >
                <UploadIcon className="h-3.5 w-3.5" />
                Upload {files.length > 0 && `(${files.length})`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
