export type CmsPreviewRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CmsPreviewFrameMetrics = {
  frameLeft: number;
  frameTop: number;
  frameWidth: number;
  frameHeight: number;
  clientWidth: number;
  clientHeight: number;
  canvasLeft: number;
  canvasTop: number;
  zoom: number;
};

export function mapCmsPreviewRectToCanvas(
  rect: CmsPreviewRect,
  metrics: CmsPreviewFrameMetrics,
): CmsPreviewRect {
  const scale = metrics.zoom / 100;
  const frameScaleX = metrics.clientWidth ? metrics.frameWidth / metrics.clientWidth : scale;
  const frameScaleY = metrics.clientHeight ? metrics.frameHeight / metrics.clientHeight : scale;
  return {
    x: (metrics.frameLeft - metrics.canvasLeft) / scale + (rect.x * frameScaleX) / scale,
    y: (metrics.frameTop - metrics.canvasTop) / scale + (rect.y * frameScaleY) / scale,
    width: (rect.width * frameScaleX) / scale,
    height: (rect.height * frameScaleY) / scale,
  };
}
