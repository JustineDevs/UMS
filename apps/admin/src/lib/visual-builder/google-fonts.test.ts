import assert from "node:assert/strict";
import test from "node:test";
import { GoogleFontsProvider, registerGoogleFontsProvider } from "./google-fonts";
import type { FontHead, FontLink } from "./google-fonts";

class FakeLink implements FontLink {
  attributes = new Map<string, string>();
  removed = false;
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  remove(): void { this.removed = true; }
}

class FakeHead implements FontHead {
  link: FakeLink | null = null;
  querySelector(selector: string): FontLink | null { return selector === "#google-fonts-link" ? this.link : null; }
  append(link: FontLink): void { this.link = link as FakeLink; }
}

test("Google font provider creates, updates, and removes the stylesheet link", () => {
  const head = new FakeHead();
  const provider = new GoogleFontsProvider(head, () => new FakeLink());
  provider.addFont("Inter");
  assert.equal(head.link?.attributes.get("href"), "https://fonts.googleapis.com/css2?display=swap&family=Inter");
  provider.addFont("Roboto");
  assert.equal(head.link?.attributes.get("href"), "https://fonts.googleapis.com/css2?display=swap&family=Inter&family=Roboto");
  provider.removeFont("Inter");
  assert.equal(head.link?.attributes.get("href"), "https://fonts.googleapis.com/css2?display=swap&family=Roboto");
  provider.removeFont("Roboto");
  assert.equal(head.link?.removed, true);
});

test("Google provider registration uses the original provider key", () => {
  const head = new FakeHead();
  const provider = new GoogleFontsProvider(head, () => new FakeLink());
  let registered = "";
  registerGoogleFontsProvider({ addProvider: (name) => { registered = name; } }, provider);
  assert.equal(registered, "google");
});
