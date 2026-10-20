"use client";

import { Copy, CornerDownLeft, Star, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { type Entry } from "@/lib/storage";
import { IconButton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function EntryRow({
  entry,
  onCopy,
  onStar,
  onReuse,
  onDelete,
}: {
  entry: Entry;
  onCopy: () => void;
  onStar: () => void;
  onReuse: () => void;
  onDelete?: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/90 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">{entry.output}</p>
        <p className="mt-1 truncate text-xs text-muted">Started from: {entry.input}</p>
      </div>
      <span className="shrink-0 text-xs text-muted">{timeAgo(entry.createdAt)}</span>
      <div className="flex shrink-0 items-center gap-2">
        <IconButton label="Use as a new start" onClick={onReuse}><CornerDownLeft className="h-4 w-4" /></IconButton>
        <IconButton label="Copy" onClick={onCopy}><Copy className="h-4 w-4" /></IconButton>
        <IconButton label={entry.saved ? "Remove from My phrases" : "Save to My phrases"} aria-pressed={entry.saved} onClick={onStar} className={cn(entry.saved && "border-primary text-primary")}>
          <Star className={cn("h-4 w-4", entry.saved && "fill-current")} />
        </IconButton>
        {onDelete && (
          <IconButton label="Delete" onClick={onDelete} className="hover:border-danger hover:text-danger"><Trash2 className="h-4 w-4" /></IconButton>
        )}
      </div>
    </li>
  );
}
