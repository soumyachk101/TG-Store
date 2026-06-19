/**
 * Typed API wrapper for the FastAPI backend.
 *
 * The browser never sees the Telegram download URL or bot token — all
 * downloads are proxied through /files/{id}/stream on the backend.
 */
import axios, { AxiosProgressEvent, AxiosRequestConfig } from "axios";
import type {
  DeleteResponse,
  FileItem,
  FileListParams,
  Folder,
  PaginatedResponse,
  StorageStats,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: false, // JWT is sent via Authorization header
});

/** Inject the bearer token from NextAuth into every request. */
let _getToken: (() => Promise<string | null>) | null = null;
export function bindTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}
api.interceptors.request.use(async (config) => {
  if (_getToken) {
    const token = await _getToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // Avoid redirect loops if already on login
      if (!window.location.pathname.startsWith("/login")) {
        // Clear the NextAuth session so the next sign-in starts fresh.
        // Without this, the same expired token keeps being sent and the
        // user gets bounced back to /login?expired=1 repeatedly.
        try {
          const { signOut } = await import("next-auth/react");
          await signOut({ redirect: false });
        } catch {
          // Best-effort: if next-auth/react isn't loadable for any reason,
          // fall through to the hard redirect.
        }
        // Append `expired=1` only the first time; if the user lands back
        // here on subsequent reloads without re-authing, the login page
        // already shows the "Session expired" banner.
        const u = new URL("/login", window.location.origin);
        u.searchParams.set("expired", "1");
        window.location.replace(u.toString());
      }
    }
    return Promise.reject(error);
  }
);

// --- Files ---

export interface UploadArgs {
  file: File;
  folderId?: string | null;
  onProgress?: (pct: number) => void;
}

export async function uploadFile({ file, folderId, onProgress }: UploadArgs): Promise<FileItem> {
  const form = new FormData();
  form.append("file", file);
  if (folderId) form.append("folder_id", folderId);
  const config: AxiosRequestConfig = {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e: AxiosProgressEvent) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  };
  const r = await api.post<FileItem>("/files/upload", form, config);
  return r.data;
}

export async function listFiles(
  params: FileListParams = {}
): Promise<PaginatedResponse<FileItem>> {
  const r = await api.get<PaginatedResponse<FileItem>>("/files", { params });
  return r.data;
}

export async function getStats(): Promise<StorageStats> {
  const r = await api.get<StorageStats>("/files/stats");
  return r.data;
}

export async function deleteFile(id: string): Promise<DeleteResponse> {
  const r = await api.delete<DeleteResponse>(`/files/${id}`);
  return r.data;
}

export async function renameFile(id: string, name: string): Promise<FileItem> {
  const r = await api.patch<FileItem>(`/files/${id}`, { name });
  return r.data;
}

export async function moveFile(id: string, folderId: string | null): Promise<FileItem> {
  const r = await api.patch<FileItem>(`/files/${id}`, { folder_id: folderId });
  return r.data;
}

/** Returns a URL that proxies file bytes through the Next.js route handler. */
export function streamUrl(id: string): string {
  return `/files/${id}/stream`;
}

// --- Folders ---

export async function listFolders(parentId?: string | null): Promise<Folder[]> {
  const r = await api.get<Folder[]>("/folders", { params: { parent_id: parentId ?? undefined } });
  return r.data;
}

export async function createFolder(name: string, parentId?: string | null): Promise<Folder> {
  const r = await api.post<Folder>("/folders", { name, parent_id: parentId ?? null });
  return r.data;
}

export async function deleteFolder(id: string): Promise<DeleteResponse> {
  const r = await api.delete<DeleteResponse>(`/folders/${id}`);
  return r.data;
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  const r = await api.patch<Folder>(`/folders/${id}`, { name });
  return r.data;
}
