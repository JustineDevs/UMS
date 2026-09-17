import Link from "next/link";
import { StarRatingDisplay } from "@/components/ReviewStarRatingDisplay";

export function ProductRatingNearTitle({
  average,
  count,
}: {
  average: number;
  count: number;
}) {
  if (count < 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <span className="font-headline text-lg font-bold tabular-nums text-primary md:text-xl">
        {average.toFixed(1)}
      </span>
      <StarRatingDisplay value={average} size="sm" />
      <Link
        href="#reviews"
        className="text-sm text-on-surface-variant underline decoration-outline-variant/40 underline-offset-2 hover:text-primary"
      >
        {count} review{count === 1 ? "" : "s"}
      </Link>
    </div>
  );
}
