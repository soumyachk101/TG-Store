"""Utilities: small helpers used across routers."""

from __future__ import annotations

# Top-level MIME groups used by storage stats.
# Order matters: matches Docs/APP FLOW.md §7.
MIME_GROUPS: list[tuple[str, tuple[str, ...]]] = [
    ("Images", ("image/",)),
    ("Videos", ("video/",)),
    ("Audio", ("audio/",)),
    (
        "Documents",
        (
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument",
            "application/vnd.ms-",
            "text/",
        ),
    ),
    ("Other", ()),
]


def group_for_mime(mime: str | None) -> str:
    """Map a MIME type to a high-level group label."""
    if not mime:
        return "Other"
    for label, prefixes in MIME_GROUPS:
        if any(mime.startswith(p) for p in prefixes):
            return label
    return "Other"


def human_size(num_bytes: int | None) -> str:
    """Format bytes as a human-readable string (e.g. '1.4 MB')."""
    if not num_bytes:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num_bytes)
    idx = 0
    while size >= 1024 and idx < len(units) - 1:
        size /= 1024
        idx += 1
    return f"{size:.1f} {units[idx]}" if idx > 0 else f"{int(size)} {units[idx]}"


def clamp(value: int, lo: int, hi: int) -> int:
    return max(lo, min(value, hi))
