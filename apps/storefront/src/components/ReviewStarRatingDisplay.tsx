export const REVIEW_STAR_PATH =
  "M12 3.1l2.4 5.5 6 .6-4.6 4 1.4 6.2L12 16.9 6.8 19.4l1.4-6.2-4.6-4 6-.6L12 3.1z";

function StarGlyph({
  fill,
  sizeClass,
}: {
  fill: number;
  sizeClass: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, fill)) * 100);
  return (
    <span className={`relative inline-flex shrink-0 ${sizeClass}`} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        className="h-full w-full text-outline-variant/40 dark:text-outline-variant/35"
        fill="currentColor"
      >
        <path d={REVIEW_STAR_PATH} />
      </svg>
      <span
        className="absolute left-0 top-0 h-full overflow-hidden text-amber-600 dark:text-amber-400"
        style={{ width: `${pct}%` }}
      >
        <svg
          viewBox="0 0 24 24"
          className={`absolute left-0 top-0 ${sizeClass}`}
          fill="currentColor"
        >
          <path d={REVIEW_STAR_PATH} />
        </svg>
      </span>
    </span>
  );
}

export type StarRatingDisplayProps = {
  /** 0–5; fractional values show partial stars (e.g. 4.2). */
  value: number;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Read-only star row for review lists and summaries (no client JS).
 */
export function StarRatingDisplay({
  value,
  size = "md",
  className = "",
}: StarRatingDisplayProps) {
  const clamped = Math.min(5, Math.max(0, value));
  const label =
    clamped % 1 === 0
      ? `${clamped} out of 5 stars`
      : `${clamped.toFixed(1)} out of 5 stars`;
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={label}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <StarGlyph key={i} fill={Math.min(1, Math.max(0, clamped - i))} sizeClass={sizeClass} />
      ))}
    </div>
  );
}
