type IconProps = { className?: string };

const base = "inline-block shrink-0 fill-none stroke-current stroke-[1.75px]";

export function IconHeart({
  className = "h-[22px] w-[22px] sm:h-6 sm:w-6",
}: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 21s-6.716-4.728-8.95-8.05C2.498 11.395 2 9.68 2 8c0-2.828 2.239-5 5-5 1.64 0 3.065.744 4 1.884A5.13 5.13 0 0 1 15 3c2.761 0 5 2.172 5 5 0 1.68-.498 3.395-2.05 5.95C18.716 16.272 12 21 12 21Z" />
    </svg>
  );
}

export function IconBag({
  className = "h-[22px] w-[22px] sm:h-6 sm:w-6",
}: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" aria-hidden>
      <path d="M6 9V6a6 6 0 1 1 12 0v3" />
      <path d="M4 9h16l-1.2 11H5.2L4 9Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPerson({
  className = "h-[22px] w-[22px] sm:h-6 sm:w-6",
}: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}
