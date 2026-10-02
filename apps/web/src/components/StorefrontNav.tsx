import Link from "next/link";
import type { CmsNavigationPayload } from "@universal-music-store/platform-data";
import { IconBag, IconHeart, IconPerson } from "./NavActionIcons";
import { StorefrontMainNav } from "./StorefrontMainNav";
import type { StorefrontNavigationSource } from "./StorefrontHeader";
import { CatalogSearchTypeahead } from "./CatalogSearchTypeahead";

export function StorefrontNav({
  navigation,
  navigationSource = "empty",
}: {
  navigation?: CmsNavigationPayload;
  navigationSource?: StorefrontNavigationSource;
}) {
  return (
    <nav
      className="relative w-full min-w-0 max-w-full font-headline tracking-tight shadow-[0px_8px_24px_rgba(0,0,0,0.06)]"
      aria-label="Primary navigation"
      data-cms-id="header-navigation"
      data-cms-label="Header navigation"
      data-navigation-source={navigationSource}
    >
      <div className="bg-primary text-on-primary">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-[clamp(0.75rem,3vw,2rem)] py-2.5 sm:gap-5 sm:py-3 max-[379px]:gap-1 max-[379px]:px-3">
          <Link
            href="/"
            data-cms-id="header-brand"
            data-cms-label="Brand"
            className="shrink-0 max-w-full text-lg font-semibold tracking-tight transition-opacity duration-200 hover:opacity-85 max-[379px]:max-w-[108px] max-[379px]:overflow-hidden max-[379px]:text-ellipsis max-[379px]:whitespace-nowrap"
            data-testid="nav-home"
            aria-label="Universal Music Store, home"
          >
            Universal Music Store
          </Link>
          <CatalogSearchTypeahead
            initialQ=""
            sort="newest"
            variant="header"
          />
          <div className="flex shrink-0 items-center gap-3 sm:gap-5 max-[379px]:gap-0" data-cms-id="header-actions" data-cms-label="Header actions">
            <Link href="/wishlist" className="grid min-h-11 min-w-11 place-items-center text-on-primary transition-[color,transform] duration-150 hover:scale-[0.96] max-[379px]:hidden" aria-label="Saved items"><IconHeart /></Link>
            <Link href="/checkout" data-testid="nav-checkout" className="grid min-h-11 min-w-11 place-items-center text-on-primary transition-[color,transform] duration-150 hover:scale-[0.96] max-[379px]:hidden" aria-label="Shopping bag"><IconBag /></Link>
            <Link href="/account/profile" data-testid="nav-account" className="grid min-h-11 min-w-11 place-items-center text-on-primary transition-[color,transform] duration-150 hover:scale-[0.96]" aria-label="Account"><IconPerson /></Link>
          </div>
        </div>
        <div
          className={
            navigation && (navigation.headerLinks.length > 0 || navigation.headerLinksMobile.length > 0)
              ? "border-t border-primary-foreground/15 bg-white text-primary"
              : "sm:hidden"
          }
        >
          <div className="mx-auto flex min-h-11 w-full max-w-[1600px] items-center px-[clamp(0.75rem,3vw,2rem)]">
            <StorefrontMainNav navigation={navigation} navigationSource={navigationSource} />
          </div>
        </div>
      </div>
    </nav>
  );
}
