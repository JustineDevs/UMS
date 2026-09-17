import { cn } from "@universal-music-store/ui";

export function cx(...inputs: Parameters<typeof cn>) {
  return cn(...inputs);
}
