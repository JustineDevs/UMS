import { Inngest } from "inngest";

/**
 * Shared Inngest client for the Medusa backend.
 *
 * Set INNGEST_EVENT_KEY to your Inngest event key (from https://www.inngest.com/docs).
 * In development with the Inngest Dev Server running, leave INNGEST_EVENT_KEY unset
 * or use the dev server default.
 */
export const inngest = new Inngest({
  id: "maharlika-apparel",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
