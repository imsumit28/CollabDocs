import {
  aspectCrop,
  presetToCrop,
  presetAspect,
  cropToPixels,
  pixelsToCrop,
  frameGeometry,
  clamp,
  clamp01,
  FULL_CROP,
} from '../app/doc/[id]/imageCrop';

describe('clamp helpers', () => {
  it('clamp bounds a value to [lo, hi]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
  it('clamp01 bounds to [0, 1]', () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });
});

describe('aspectCrop', () => {
  it('gives a centred square from a landscape image', () => {
    // 2:1 image (imageAR = 2), target square (ar = 1) → keep full height, half width
    const c = aspectCrop(1, 2);
    expect(c.cropH).toBeCloseTo(1);
    expect(c.cropW).toBeCloseTo(0.5);
    expect(c.cropX).toBeCloseTo(0.25);
    expect(c.cropY).toBeCloseTo(0);
  });

  it('gives a centred square from a portrait image', () => {
    // 1:2 image (imageAR = 0.5), target square → keep full width, half height
    const c = aspectCrop(1, 0.5);
    expect(c.cropW).toBeCloseTo(1);
    expect(c.cropH).toBeCloseTo(0.5);
    expect(c.cropY).toBeCloseTo(0.25);
  });

  it('produces the requested display aspect ratio', () => {
    const imageAR = 3; // wide image
    const targetAR = 16 / 9;
    const c = aspectCrop(targetAR, imageAR);
    // displayed aspect = (cropW*NW)/(cropH*NH) = (cropW/cropH)*imageAR
    const displayedAR = (c.cropW / c.cropH) * imageAR;
    expect(displayedAR).toBeCloseTo(targetAR);
    expect(c.cropW).toBeLessThanOrEqual(1);
    expect(c.cropH).toBeLessThanOrEqual(1);
  });
});

describe('presetToCrop', () => {
  it('original and full return the whole image', () => {
    expect(presetToCrop('original', 1.5, FULL_CROP)).toEqual(FULL_CROP);
    expect(presetToCrop('full', 1.5, FULL_CROP)).toEqual(FULL_CROP);
  });
  it('halves carve the expected region', () => {
    expect(presetToCrop('half-left', 1, FULL_CROP)).toEqual({ cropX: 0, cropY: 0, cropW: 0.5, cropH: 1 });
    expect(presetToCrop('half-right', 1, FULL_CROP)).toEqual({ cropX: 0.5, cropY: 0, cropW: 0.5, cropH: 1 });
    expect(presetToCrop('half-top', 1, FULL_CROP)).toEqual({ cropX: 0, cropY: 0, cropW: 1, cropH: 0.5 });
    expect(presetToCrop('half-bottom', 1, FULL_CROP)).toEqual({ cropX: 0, cropY: 0.5, cropW: 1, cropH: 0.5 });
  });
  it('custom preserves the current rect', () => {
    const cur = { cropX: 0.1, cropY: 0.2, cropW: 0.3, cropH: 0.4 };
    expect(presetToCrop('custom', 1, cur)).toEqual(cur);
  });
  it('circle behaves like a 1:1 crop', () => {
    expect(presetToCrop('circle', 2, FULL_CROP)).toEqual(presetToCrop('square', 2, FULL_CROP));
  });
});

describe('presetAspect', () => {
  it('returns locked ratios for fixed presets and null otherwise', () => {
    expect(presetAspect('square')).toBe(1);
    expect(presetAspect('landscape')).toBeCloseTo(16 / 9);
    expect(presetAspect('portrait')).toBeCloseTo(3 / 4);
    expect(presetAspect('custom')).toBeNull();
    expect(presetAspect('half-left')).toBeNull();
  });
});

describe('pixel <-> crop round-trip', () => {
  it('cropToPixels then pixelsToCrop recovers the original fractions', () => {
    const c = { cropX: 0.2, cropY: 0.1, cropW: 0.5, cropH: 0.6 };
    const dispW = 400;
    const dispH = 300;
    const px = cropToPixels(c, dispW, dispH);
    expect(px).toEqual({ x: 80, y: 30, w: 200, h: 180 });
    expect(pixelsToCrop(px, dispW, dispH)).toEqual(c);
  });
  it('pixelsToCrop clamps out-of-range rects into [0,1]', () => {
    const c = pixelsToCrop({ x: -50, y: 0, w: 999, h: 400 }, 400, 300);
    expect(c.cropX).toBe(0);
    expect(c.cropW).toBe(1);
    expect(c.cropH).toBe(1);
  });
});

describe('frameGeometry', () => {
  it('scales the inner image so the crop region fills the frame', () => {
    // width 300, square image (imageAR 1), keep left half (cropW 0.5, full height)
    const g = frameGeometry(300, 1, { cropX: 0, cropY: 0, cropW: 0.5, cropH: 1 });
    expect(g.frameWidth).toBe(300);
    expect(g.innerWidth).toBe(600); // 300 / 0.5
    expect(g.innerHeight).toBe(600); // innerWidth / imageAR
    expect(g.frameHeight).toBe(600); // cropH * innerHeight
    expect(g.offsetLeft).toBe(-0); // cropX 0
    expect(g.offsetTop).toBe(-0);
  });
  it('offsets the inner image for a non-zero crop origin', () => {
    const g = frameGeometry(200, 2, { cropX: 0.25, cropY: 0.5, cropW: 0.5, cropH: 0.5 });
    expect(g.innerWidth).toBe(400); // 200 / 0.5
    expect(g.innerHeight).toBe(200); // 400 / 2
    expect(g.offsetLeft).toBe(-100); // -0.25 * 400
    expect(g.offsetTop).toBe(-100); // -0.5 * 200
    expect(g.frameHeight).toBe(100); // 0.5 * 200
  });
});
