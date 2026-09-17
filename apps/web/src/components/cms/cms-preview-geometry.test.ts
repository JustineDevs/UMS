import assert from "node:assert/strict";
import test from "node:test";
import { mapCmsPreviewRectToCanvas } from "./cms-preview-geometry";

test("maps iframe selection geometry into the zoomed canvas", () => {
  assert.deepEqual(
    mapCmsPreviewRectToCanvas(
      { x: 20, y: 30, width: 100, height: 40 },
      {
        frameLeft: 140,
        frameTop: 80,
        frameWidth: 800,
        frameHeight: 600,
        clientWidth: 1000,
        clientHeight: 750,
        canvasLeft: 40,
        canvasTop: 20,
        zoom: 80,
      },
    ),
    { x: 145, y: 105, width: 100, height: 40 },
  );
});

test("keeps geometry stable when iframe CSS scale matches canvas zoom", () => {
  const rect = { x: 12, y: 18, width: 80, height: 24 };
  const metrics = {
    frameLeft: 100,
    frameTop: 60,
    frameWidth: 800,
    frameHeight: 600,
    clientWidth: 1000,
    clientHeight: 750,
    canvasLeft: 0,
    canvasTop: 0,
    zoom: 80,
  };
  assert.deepEqual(mapCmsPreviewRectToCanvas(rect, metrics), mapCmsPreviewRectToCanvas(rect, metrics));
});
