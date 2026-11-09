export type Camera = { x: number; y: number; scale: number };
export type Point = { x: number; y: number };
export const MIN_SCALE = 0.16;
export const MAX_SCALE = 2;
export const clampScale = (scale: number) =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
export function zoomAt(camera: Camera, scale: number, anchor: Point): Camera {
  const nextScale = clampScale(scale);
  const ratio = nextScale / camera.scale;
  return {
    x: anchor.x - (anchor.x - camera.x) * ratio,
    y: anchor.y - (anchor.y - camera.y) * ratio,
    scale: nextScale,
  };
}
export function fitRect(
  rect: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
  widthOnly = false,
): Camera {
  const paddingX = viewport.width < 700 ? 22 : 90;
  const scale = clampScale(
    Math.min(
      (viewport.width - paddingX * 2) / rect.width,
      widthOnly ? 1 : (viewport.height - 170) / rect.height,
      1,
    ),
  );
  return {
    x: (viewport.width - rect.width * scale) / 2 - rect.x * scale,
    y: widthOnly
      ? 95 - rect.y * scale
      : 80 + (viewport.height - 170 - rect.height * scale) / 2 - rect.y * scale,
    scale,
  };
}
