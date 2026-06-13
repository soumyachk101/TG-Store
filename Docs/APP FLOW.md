# Application Flow
## TGStore — Screen-by-Screen User Journey

**Version:** 1.0  
**Author:** Soumya Chakraborty

---

## 1. Entry & Authentication

### Flow: First Visit (Unauthenticated)

```
User visits https://tgstore.vercel.app/
        │
        ▼
Next.js middleware checks session cookie
        │  no session
        ▼
Redirect → /login
        │
        ▼
Login Page
  ├── Username input
  ├── Password input
  └── "Sign In" button
        │
        ▼
POST /auth/login  →  FastAPI validates credentials
        │
        ├── Invalid  → Show error toast "Invalid credentials"
        │
        └── Valid    → JWT stored in httpOnly cookie
                       Redirect → /  (Dashboard)
```

### Flow: Returning User

```
User visits any page
        │
        ▼
Middleware finds valid session cookie
        │
        ▼
Render requested page directly (no redirect)
        │
Token expired?
        └── Auto-redirect /login with ?next= param
            After login → redirect back to original page
```

---

## 2. Dashboard (Root View)

### Layout

```
┌─────────────────────────────────────────────────────┐
│  TGStore           [Search bar]        [User avatar] │
├──────────────┬──────────────────────────────────────┤
│              │  My Files                    [+ New ▾]│
│  📁 All Files│  ────────────────────────────────────│
│  📁 Images   │  [Folder: Projects]  [Folder: Docs]  │
│  📁 Documents│                                       │
│  📁 Videos   │  file-1.pdf   2.3 MB   Jun 10        │
│  ─────────── │  image.png    890 KB   Jun 9         │
│  📁 Projects │  notes.txt    12 KB    Jun 8         │
│  📁 Docs     │  video.mp4    450 MB   Jun 1         │
│              │                                       │
│  Storage     │  [Load more...]                       │
│  12 MB used  │                                       │
└──────────────┴──────────────────────────────────────┘
```

### States

- **Loading:** Skeleton cards shown while TanStack Query fetches
- **Empty (no files):** "Upload your first file" empty state with upload CTA
- **Empty (folder):** "This folder is empty" with upload CTA
- **Error:** Toast notification + retry button

---

## 3. File Upload Flow

### Trigger Options

- Drag a file onto the file list area (dropzone active on hover)
- Click the `[+ New]` button → `Upload File`
- Keyboard shortcut: `U`

### Upload Steps

```
Step 1: File Selection
  ├── Drag-and-drop onto dropzone
  └── File picker dialog (click)
          │
          ▼
Step 2: Pre-upload Validation (client-side)
  ├── Size check: > 2 GB? → Error toast "File too large (max 2 GB)"
  └── Valid → show upload progress modal
          │
          ▼
Step 3: Upload in Progress
  ┌──────────────────────────────┐
  │ Uploading file-name.pdf      │
  │ [████████░░░░░░░░░░] 47%     │
  │ 1.1 MB / 2.3 MB              │
  │ [Cancel]                     │
  └──────────────────────────────┘
  (POST /files/upload via FormData + XMLHttpRequest for progress)
          │
          ▼
Step 4: Backend Processing
  FastAPI → sendDocument to Telegram → save tg_file_id to DB
          │
          ├── Telegram error → Show "Upload failed. Try again."
          │
          └── Success
                  │
                  ▼
Step 5: Success
  ├── Modal closes
  ├── Success toast: "file-name.pdf uploaded"
  └── File list refreshes (TanStack Query cache invalidation)
```

---

## 4. File Actions

### Right-click / Kebab Menu on File

```
┌─────────────────┐
│ 👁  Preview      │
│ ⬇  Download     │
│ ✏  Rename       │
│ 📁  Move to...   │
│ 🗑  Delete       │
└─────────────────┘
```

### 4.1 Preview Flow

```
User clicks Preview (or double-clicks file)
        │
        ▼
Check MIME type
  ├── image/*    → render <img> in modal
  ├── video/mp4  → render <video> player in modal
  ├── audio/mp3  → render <audio> player in modal
  ├── application/pdf → render <react-pdf> viewer in modal
  └── other      → show "Preview not available" + Download button
        │
        ▼
GET /files/{id}/download-url
  FastAPI → Telegram getFile → returns fresh URL
        │
        ▼
PreviewModal opens with content
  [← Prev file]  [file-name.pdf — 2.3 MB]  [Next file →]
                  [⬇ Download]  [✕ Close]
```

### 4.2 Download Flow

```
User clicks Download
        │
        ▼
GET /files/{id}/download-url  →  receive Telegram URL
        │
        ▼
Create hidden <a download> link → programmatically click
Browser starts file download
```

### 4.3 Rename Flow

```
User clicks Rename
        │
        ▼
Inline text input replaces filename in row
  Current name pre-filled
        │
  Enter / click ✓           Escape / click ✗
        │                          │
        ▼                          ▼
PATCH /files/{id}           Discard, restore original name
  { "name": "new-name.pdf" }
        │
        ▼
Optimistic UI update → confirm on API success
```

### 4.4 Delete Flow

```
User clicks Delete
        │
        ▼
Confirmation dialog:
  "Delete file-name.pdf? This cannot be undone."
  [Cancel]  [Delete]
        │
        ▼  (user confirms)
DELETE /files/{id}
  FastAPI → sets deleted_at in DB
  (File stays on Telegram CDN — can be recovered from DB if needed)
        │
        ▼
Optimistic removal from list
Success toast: "file-name.pdf deleted"
```

---

## 5. Folder Flow

### Create Folder

```
[+ New] → "New Folder"
        │
        ▼
Inline input in sidebar: "Untitled Folder"
  Enter to confirm
        │
        ▼
POST /folders  { "name": "New Folder", "parent_id": current_folder_id }
        │
        ▼
Folder appears in sidebar + main area
```

### Navigate Into Folder

```
User clicks folder card
        │
        ▼
Router push: /folder/{folder_id}
        │
        ▼
Breadcrumb updates: My Files > Projects > Q2
File list re-fetches with folder_id filter
```

### Move File to Folder

```
Right-click → Move to...
        │
        ▼
Folder picker modal (tree view)
  📁 Projects
    📁 Q2
    📁 Q3
  📁 Documents
        │
  User selects folder
        │
        ▼
PATCH /files/{id}  { "folder_id": "selected_folder_id" }
        │
        ▼
File disappears from current view → success toast
```

---

## 6. Search Flow

```
User types in search bar (debounced 300ms)
        │
        ▼
GET /files?search=query&folder=all
        │
        ▼
Results update live
  ├── Filename matches highlighted
  ├── Folder path shown under each result
  └── No results → "No files match 'query'"

Filter chips available:
  [All] [Images] [Documents] [Videos] [Audio] [Other]
  [This folder] [All folders]
  [Date ▾] [Size ▾]
```

---

## 7. Storage Stats (Dashboard Widget)

```
┌────────────────────────────────────┐
│ Storage Overview                   │
│                                    │
│  Total files:     247              │
│  Total size:      3.2 GB           │
│                                    │
│  Images    ██████░░  42%  1.3 GB   │
│  Videos    ████░░░░  28%  0.9 GB   │
│  Documents ███░░░░░  20%  0.6 GB   │
│  Other     █░░░░░░░  10%  0.4 GB   │
└────────────────────────────────────┘
```

Stats fetched from:
```
GET /files/stats
→ { total_count, total_size, by_type: [{mime_group, count, size}] }
```

---

## 8. Error States

| Scenario | UI Behaviour |
|----------|-------------|
| No internet | Toast: "You're offline. Changes will sync when reconnected." |
| Upload fails mid-way | Error toast + retry button in upload modal |
| File not found (deleted externally) | 404 page with "Back to files" link |
| Session expired | Redirect /login with "Session expired, please sign in again" |
| Telegram API down | Toast: "Storage service temporarily unavailable. Try again shortly." |
| File too large (>2 GB) | Client-side block before upload starts |

---

## 9. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `U` | Open upload dialog |
| `N` | New folder |
| `F` | Focus search bar |
| `Escape` | Close modal / cancel inline edit |
| `Enter` | Confirm rename / open selected file |
| `Delete` | Delete selected file (with confirmation) |
| `←` / `→` | Navigate files in preview modal |