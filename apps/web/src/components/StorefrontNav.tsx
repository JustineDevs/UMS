import Link from "next/link";
import { Search } from "lucide-react";
import { IconBag, IconHeart, IconPerson } from "./NavActionIcons";

export function StorefrontNav() {
  return (
    <nav
      className="relative w-full min-w-0 max-w-full font-headline tracking-tight shadow-[0px_8px_24px_rgba(0,0,0,0.06)]"
      aria-label="Primary navigation"
      data-cms-id="header-navigation"
      data-cms-label="Header navigation"
    >
      <div className="bg-primary text-on-primary">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-[clamp(0.75rem,3vw,2rem)] py-2.5 sm:gap-5 sm:py-3">
          <Link
            href="/"
            data-cms-id="header-brand"
            data-cms-label="Brand"
            className="shrink-0 text-lg font-semibold tracking-tight transition-opacity duration-200 hover:opacity-85"
            data-testid="nav-home"
            aria-label="Universal Music Store, home"
          >
            Universal Music Store
          </Link>
          <form action="/shop" method="get" className="flex min-w-0 flex-1 items-center">
            <label htmlFor="storefront-search" className="sr-only">Search products</label>
            <input
              id="storefront-search"
              name="q"
              type="search"
              placeholder="Search instruments, gear, and accessories"
              className="min-h-11 min-w-0 flex-1 rounded-l-md border-0 bg-white px-3 text-sm text-primary outline-none placeholder:text-on-surface-variant/65 focus:ring-2 focus:ring-on-primary/60 sm:px-4"
              autoComplete="off"
            />
            <button type="submit" aria-label="Search" className="grid min-h-11 min-w-11 place-items-center rounded-r-md bg-on-primary text-primary hover:bg-on-primary/90">
              <Search className="size-5" aria-hidden="true" />
            </button>
          </form>
          <div className="flex shrink-0 items-center gap-3 sm:gap-5" data-cms-id="header-actions" data-cms-label="Header actions">
            <Link href="/wishlist" className="text-on-primary transition-transform duration-200 hover:scale-95" aria-label="Saved items"><IconHeart /></Link>
            <Link href="/checkout" data-testid="nav-checkout" className="text-on-primary transition-transform duration-200 hover:scale-95" aria-label="Shopping bag"><IconBag /></Link>
            <Link href="/account" data-testid="nav-account" className="text-on-primary transition-transform duration-200 hover:scale-95" aria-label="Account"><IconPerson /></Link>
          </div>
        </div>
        <div className="mx-auto hidden max-w-[1600px] items-center gap-5 overflow-x-auto px-[clamp(0.75rem,3vw,2rem)] pb-2 text-[10px] text-on-primary/75 sm:flex sm:gap-7 sm:text-xs md:gap-8">
          {[["/shop?category=guitars", "Guitars"], ["/shop?category=amplifiers", "Amplifiers"], ["/shop?category=effects", "Effects"], ["/shop?category=keyboards", "Keyboards & pianos"], ["/shop?category=drums", "Drums"], ["/shop?category=accessories", "Accessories & gear"]].map(([href, label]) => <Link key={href} href={href} className="shrink-0 whitespace-nowrap hover:text-on-primary">{label}</Link>)}
        </div>
      </div>
    </nav>
  );
}
