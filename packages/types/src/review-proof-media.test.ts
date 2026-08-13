import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inferReviewProofMedia } from "./review-proof-media.ts";

describe("review-proof-media", () => {
  it("infers images, videos, and fallback links", () => {
    assert.deepEqual(inferReviewProofMedia("https://cdn.example.com/proof.jpg"), {
      kind: "image",
      url: "https://cdn.example.com/proof.jpg",
    });
    assert.deepEqual(inferReviewProofMedia("https://cdn.example.com/proof.mp4"), {
      kind: "video",
      url: "https://cdn.example.com/proof.mp4",
    });
    assert.deepEqual(inferReviewProofMedia("https://www.youtube.com/watch?v=123"), {
      kind: "link",
      url: "https://www.youtube.com/watch?v=123",
    });
    assert.equal(inferReviewProofMedia(""), null);
  });
});
