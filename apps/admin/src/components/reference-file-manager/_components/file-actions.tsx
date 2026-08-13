import { Download, MoreVertical, Share2, Star, Trash2 } from "lucide-react";
import { sanitizeTrustedPublicUrl } from "@universal-music-store/sdk";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { FileManagerFile } from "./data";

interface FileActionsProps {
  file: FileManagerFile;
  onToggleStar: () => void;
  onDelete?: () => void;
}

export function FileActions({ file, onToggleStar, onDelete }: FileActionsProps) {
  const safePublicUrl = sanitizeTrustedPublicUrl(file.publicUrl);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${file.name}`}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onToggleStar}>
            <Star />
            {file.starred ? "Remove from starred" : "Add to starred"}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!safePublicUrl} onSelect={() => {
            if (safePublicUrl) window.open(safePublicUrl, "_blank", "noopener,noreferrer");
          }}>
            <Download />
            Download
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!safePublicUrl} onSelect={() => {
            if (safePublicUrl) void navigator.clipboard?.writeText(safePublicUrl);
          }}>
            <Share2 />
            Copy share link
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" disabled={!onDelete} onSelect={onDelete}>
            <Trash2 />
            Move to trash
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
