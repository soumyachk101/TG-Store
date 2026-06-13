# Product Requirements Document (PRD)
## TGStore — Personal Cloud Storage on Telegram

**Version:** 1.0  
**Author:** Soumya Chakraborty  
**Date:** June 2026  
**Status:** Draft

---

## 1. Overview

### 1.1 Problem Statement

Personal cloud storage solutions (Google Drive, Dropbox) require paid plans for meaningful storage capacity, carry vendor lock-in risk, and offer limited control over data. A developer building personal tools needs a free, self-hosted alternative that is easy to deploy and integrates with existing workflow.

### 1.2 Product Vision

TGStore is a self-hosted personal cloud storage system that uses Telegram's infrastructure as a free CDN backend. The user interacts with a clean web UI (Next.js) while the system silently stores all files on Telegram servers — accessed via a FastAPI backend and indexed in PostgreSQL.

### 1.3 Target Users

- Primary: The developer (Soumya) — personal use, full control
- Secondary: Any developer who self-hosts this open-source project

---

## 2. Goals & Non-Goals

### Goals

- Upload any file up to 2 GB and retrieve it on demand
- Organize files in a folder-like hierarchy
- Search and filter files by name, type, date
- Preview images and PDFs inline in the browser
- Secure access via authentication (single-user or invite-based)
- Deploy entirely on free tiers (Railway/Render + Vercel + Telegram)

### Non-Goals

- Real-time collaboration (not Google Docs)
- Multi-user SaaS with billing
- Mobile-native app (web-responsive is sufficient)
- Replacing Telegram as a messaging app

---

## 3. Core Features

### 3.1 File Upload

- Drag-and-drop or click-to-browse upload from the web UI
- Chunked upload support for large files (>50 MB)
- Progress indicator during upload
- File deduplication check by name + size before upload
- Supported: any MIME type Telegram accepts

### 3.2 File Management

- List all files with name, size, type, upload date
- Soft-delete (mark deleted in DB, message stays in Telegram channel)
- Rename files (metadata update only, no re-upload)
- Move files between folders

### 3.3 Folder System

- Create, rename, delete folders
- Nested folders (max 3 levels deep for simplicity)
- Root `/` folder as default
- Breadcrumb navigation in UI

### 3.4 Download & Preview

- Secure download via signed URL (proxied through FastAPI)
- Inline preview for: images (jpg, png, gif, webp), PDF, video (mp4), audio (mp3)
- Download URL generated fresh from Telegram's `getFile` API on each request (Telegram URLs expire in ~1 hour)

### 3.5 Search

- Full-text search on filename
- Filter by: MIME type, folder, date range, file size

### 3.6 Authentication

- Single-user auth via JWT (username + password stored in env)
- Optional: NextAuth.js with GitHub/Google OAuth for convenience
- All API endpoints protected — unauthenticated requests return 401

---

## 4. User Stories

| ID | As a user, I want to... | Acceptance Criteria |
|----|-------------------------|---------------------|
| US-01 | Upload a file from my browser | File appears in list within 5s of upload completing |
| US-02 | Organize files into folders | I can create folders and drag files into them |
| US-03 | Search for a file by name | Results appear as I type (debounced 300ms) |
| US-04 | Preview an image without downloading | Image renders inline in a modal |
| US-05 | Download any file | Clicking download starts the file download |
| US-06 | Delete a file I no longer need | File disappears from UI; DB marks it deleted |
| US-07 | Access my storage only (auth) | Visiting the URL without login redirects to /login |
| US-08 | See storage stats | Dashboard shows total files, total size used |

---

## 5. Technical Constraints

- Telegram Bot API file limit: **2 GB per file**
- Telegram `getFile` URL TTL: **~1 hour** (must regenerate on each download)
- Bot API rate limit: **30 messages/second**
- No paid infra — must run on Vercel (frontend) + Railway/Render free tier (backend)
- PostgreSQL hosted on Neon or Railway free tier

---

## 6. Success Metrics

| Metric | Target |
|--------|--------|
| File upload success rate | > 99% |
| File retrieval latency (P95) | < 3 seconds |
| UI load time (initial) | < 2 seconds |
| Zero data loss | file_id always preserved in DB |

---

## 7. Milestones

| Phase | Deliverable | Timeline |
|-------|-------------|----------|
| Phase 1 | Core upload/download, flat file list, basic auth | Week 1–2 |
| Phase 2 | Folders, search, delete, rename | Week 3 |
| Phase 3 | Inline preview, storage stats dashboard | Week 4 |
| Phase 4 | Polish, error handling, deploy to prod | Week 5 |