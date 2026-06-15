/** Shared types matching the backend Pydantic schemas. */
export type UUID = string;

export interface FileItem {
  id: UUID;
  name: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  folder_id: UUID | null;
  tg_file_id: string;
  tg_message_id: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
}

export interface FileListParams {
  page?: number;
  limit?: number;
  search?: string;
  folder_id?: UUID | null;
  root_only?: boolean;
  mime_type?: string;
  include_deleted?: boolean;
}

export interface Folder {
  id: UUID;
  name: string;
  parent_id: UUID | null;
  path: string;
  created_at: string;
}

export interface TypeStat {
  mime_group: string;
  count: number;
  size: number;
}

export interface StorageStats {
  total_count: number;
  total_size: number;
  by_type: TypeStat[];
}

export interface DeleteResponse {
  success: boolean;
  id: UUID;
}
