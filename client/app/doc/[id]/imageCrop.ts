// Pure geometry helpers for non-destructive image cropping.
//
// Crop is stored on the node as normalized fractions of the *natural* image:
//   cropX, cropY = top-left of the kept region (0..1)
//   cropW, cropH = size of the kept region (0..1)
// This keeps cropping resolution-independent and fully reversible — the original
// data URL is never re-encoded. These functions are side-effect free (except
// `rasterize`, which needs a browser canvas) so the maths can be unit-tested.

export type CropRect = { cropX: number; cropY: number; cropW: number; cropH: number };

export const FULL_CROP: CropRect = { cropX: 0, cropY: 0, cropW: 1, cropH: 1 };

export type CropPreset =
  | 'original'
  | 'full'
  | 'square'
  | 'portrait'
  | 'landscape'
  | 'circle'
  | 'half-left'
  | 'half-right'
  | 'half-top'
  | 'half-bottom'
  | 'custom';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Largest centred crop that yields the given *display* aspect ratio (width/height)
// for an image whose natural aspect ratio is `imageAR` (naturalWidth / naturalHeight).
export function aspectCrop(ar: number, imageAR: number): CropRect {
  // Displayed aspect of a crop = (cropW*NW)/(cropH*NH); solving for cropW/cropH:
  const ratioWH = ar / imageAR;
  let cropW: number;
  let cropH: number;
  if (ratioWH >= 1) {
    cropW = 1;
    cropH = 1 / ratioWH;
  } else {
    cropH = 1;
    cropW = ratioWH;
  }
  return { cropX: (1 - cropW) / 2, cropY: (1 - cropH) / 2, cropW, cropH };
}

// Map a named preset to a concrete crop rectangle. `current` is returned for
// 'custom' so free-drag state is preserved.
export function presetToCrop(preset: CropPreset, imageAR: number, current: CropRect): CropRect {
  switch (preset) {
    case 'original':
    case 'full':
      return { ...FULL_CROP };
    case 'square':
    case 'circle':
      return aspectCrop(1, imageAR);
    case 'portrait':
      return aspectCrop(3 / 4, imageAR);
    case 'landscape':
      return aspectCrop(16 / 9, imageAR);
    case 'half-left':
      return { cropX: 0, cropY: 0, cropW: 0.5, cropH: 1 };
    case 'half-right':
      return { cropX: 0.5, cropY: 0, cropW: 0.5, cropH: 1 };
    case 'half-top':
      return { cropX: 0, cropY: 0, cropW: 1, cropH: 0.5 };
    case 'half-bottom':
      return { cropX: 0, cropY: 0.5, cropW: 1, cropH: 0.5 };
    case 'custom':
    default:
      return { ...current };
  }
}

// Locked display aspect ratio for a preset, or null when free (custom/halves/full).
export function presetAspect(preset: CropPreset): number | null {
  switch (preset) {
    case 'square':
    case 'circle':
      return 1;
    case 'portrait':
      return 3 / 4;
    case 'landscape':
      return 16 / 9;
    default:
      return null;
  }
}

export type PixelRect = { x: number; y: number; w: number; h: number };

// Convert between fractional crop and pixel rect over the full image displayed at
// (dispW × dispH) inside crop mode.
export function cropToPixels(c: CropRect, dispW: number, dispH: number): PixelRect {
  return { x: c.cropX * dispW, y: c.cropY * dispH, w: c.cropW * dispW, h: c.cropH * dispH };
}

export function pixelsToCrop(px: PixelRect, dispW: number, dispH: number): CropRect {
  return {
    cropX: clamp01(px.x / dispW),
    cropY: clamp01(px.y / dispH),
    cropW: clamp01(px.w / dispW),
    cropH: clamp01(px.h / dispH),
  };
}

// Geometry for the non-destructive render: an overflow-hidden frame showing the
// crop region of an oversized inner <img> shifted by negative offsets.
export function frameGeometry(width: number, imageAR: number, c: CropRect) {
  const innerWidth = width / c.cropW;
  const innerHeight = innerWidth / imageAR; // imageAR = NW/NH
  return {
    innerWidth,
    innerHeight,
    frameWidth: width,
    frameHeight: c.cropH * innerHeight,
    offsetLeft: -c.cropX * innerWidth,
    offsetTop: -c.cropY * innerHeight,
  };
}

// Rasterize the current crop + rotation + flip to a PNG data URL. Used only for
// the one-off "Download" action — it never mutates the stored image. Requires a
// DOM canvas, so it's browser-only.
export function rasterize(
  img: HTMLImageElement,
  crop: CropRect,
  rotate: number,
  flipH: boolean,
  flipV: boolean,
): string {
  const NW = img.naturalWidth;
  const NH = img.naturalHeight;
  const sx = crop.cropX * NW;
  const sy = crop.cropY * NH;
  const sw = Math.max(1, crop.cropW * NW);
  const sh = Math.max(1, crop.cropH * NH);

  // 1) draw just the cropped region to an intermediate canvas
  const base = document.createElement('canvas');
  base.width = Math.round(sw);
  base.height = Math.round(sh);
  const bctx = base.getContext('2d');
  if (!bctx) return img.src;
  bctx.drawImage(img, sx, sy, sw, sh, 0, 0, base.width, base.height);

  // 2) apply rotation/flip
  const rot = (((rotate % 360) + 360) % 360);
  const swap = rot === 90 || rot === 270;
  const out = document.createElement('canvas');
  out.width = swap ? base.height : base.width;
  out.height = swap ? base.width : base.height;
  const ctx = out.getContext('2d');
  if (!ctx) return base.toDataURL('image/png');
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(base, -base.width / 2, -base.height / 2);
  return out.toDataURL('image/png');
}

// Width presets (px) for the toolbar. "Full" is handled via the fullWidth flag.
export const WIDTH_PRESETS = { small: 200, medium: 360, large: 600 } as const;
export const MIN_IMAGE_WIDTH = 48;
