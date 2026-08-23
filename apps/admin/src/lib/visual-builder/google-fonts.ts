export type FontLink = {
  setAttribute(name: string, value: string): void;
  remove(): void;
};

export type FontHead = {
  querySelector(selector: string): FontLink | null;
  append(link: FontLink): void;
};

export type FontLinkFactory = () => FontLink;

/** Port of plugin-google-fonts.js:22-55 without global state. */
export class GoogleFontsProvider {
  readonly url = "https://fonts.googleapis.com/css2?display=swap&family=";
  readonly activeFonts: string[] = [];

  constructor(private readonly head: FontHead, private readonly createLink: FontLinkFactory) {}

  addFont(fontName: string): void {
    this.activeFonts.push(fontName);
    this.updateFontList();
  }

  removeFont(fontName: string): void {
    const index = this.activeFonts.indexOf(fontName);
    this.activeFonts.splice(index, 1);
    this.updateFontList();
  }

  private updateFontList(): void {
    let link = this.head.querySelector("#google-fonts-link");
    if (this.activeFonts.length === 0) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.createLink();
      this.head.append(link);
    }
    link.setAttribute("href", this.url + this.activeFonts.join("&family="));
  }
}

export type FontProviderRegistry = {
  addProvider(provider: string, implementation: GoogleFontsProvider): void;
};

export function registerGoogleFontsProvider(
  registry: FontProviderRegistry,
  provider: GoogleFontsProvider,
): void {
  registry.addProvider("google", provider);
}
