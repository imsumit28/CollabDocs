'use client';
// Google-Docs / Word-style inline image editing, rendered as a TipTap React
// NodeView. Everything (selection, resize, crop, rotate/flip, layout, caption)
// happens in place — no modal. Cropping is non-destructive: the original data
// URL is untouched and we store crop fractions on the node, rendering the kept
// region with an overflow-hidden frame + offset inner <img>.
//
// Performance: resize/crop drags write to refs and flush to local state inside a
// requestAnimationFrame tick; the node is only committed to ProseMirror/Yjs once
// on release (or on crop Apply), so we never dispatch a collab transaction per
// pointermove. The NodeView is isolated, so re-renders stay local to one image.
import { useEffect, useRef, useState, CSSProperties } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/core';
import {
  CropRect,
  CropPreset,
  PixelRect,
  presetToCrop,
  cropToPixels,
  pixelsToCrop,
  frameGeometry,
  rasterize,
  clamp,
  WIDTH_PRESETS,
  MIN_IMAGE_WIDTH,
} from './imageCrop';

// Eight handles positioned at the box corners/edges (shared by resize + crop).
const HANDLES: { id: string; cx: string; cy: string; cursor: string; label: string }[] = [
  { id: 'nw', cx: '0%', cy: '0%', cursor: 'nwse-resize', label: 'top left' },
  { id: 'n', cx: '50%', cy: '0%', cursor: 'ns-resize', label: 'top' },
  { id: 'ne', cx: '100%', cy: '0%', cursor: 'nesw-resize', label: 'top right' },
  { id: 'e', cx: '100%', cy: '50%', cursor: 'ew-resize', label: 'right' },
  { id: 'se', cx: '100%', cy: '100%', cursor: 'nwse-resize', label: 'bottom right' },
  { id: 's', cx: '50%', cy: '100%', cursor: 'ns-resize', label: 'bottom' },
  { id: 'sw', cx: '0%', cy: '100%', cursor: 'nesw-resize', label: 'bottom left' },
  { id: 'w', cx: '0%', cy: '50%', cursor: 'ew-resize', label: 'left' },
];

const CROP_MIN = 24; // px, minimum crop rectangle side
const PRESETS: { id: CropPreset; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'full', label: 'Full' },
  { id: 'square', label: '1:1' },
  { id: 'portrait', label: '3:4' },
  { id: 'landscape', label: '16:9' },
  { id: 'circle', label: 'Circle' },
  { id: 'half-left', label: 'Half L' },
  { id: 'half-right', label: 'Half R' },
  { id: 'half-top', label: 'Half T' },
  { id: 'half-bottom', label: 'Half B' },
];

type DragState =
  | { kind: 'resize'; id: string; startX: number; startY: number; startW: number; ratio: number; maxW: number }
  | { kind: 'cropmove'; startX: number; startY: number; rect: PixelRect; dispW: number; dispH: number }
  | { kind: 'crophandle'; id: string; startX: number; startY: number; rect: PixelRect; dispW: number; dispH: number };

export default function ImageNodeView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected, editor, getPos } = props;
  const a = node.attrs as Record<string, any>;
  const src: string = a.src;
  const alt: string = a.alt || '';
  const caption: string = a.caption || '';
  const align: string = a.align || 'center';
  const wrap: string = a.wrap || 'none';
  const rotate: number = a.rotate || 0;
  const flipH: boolean = !!a.flipH;
  const flipV: boolean = !!a.flipV;
  const round: boolean = !!a.round;
  const fullWidth: boolean = !!a.fullWidth;
  const width: number | null = typeof a.width === 'number' ? a.width : null;
  const crop: CropRect = { cropX: a.cropX ?? 0, cropY: a.cropY ?? 0, cropW: a.cropW ?? 1, cropH: a.cropH ?? 1 };
  const isEditable = editor.isEditable;

  const rootRef = useRef<HTMLDivElement>(null);
  const fullImgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const liveWidthRef = useRef<number | null>(null);
  const cropPxRef = useRef<PixelRect | null>(null);
  const cropDispRef = useRef<{ w: number; h: number } | null>(null);

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [containerW, setContainerW] = useState(0);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [cropping, setCropping] = useState(false);
  const [cropPx, setCropPx] = useState<PixelRect | null>(null);
  const [cropDisp, setCropDisp] = useState<{ w: number; h: number } | null>(null);
  const [activePreset, setActivePreset] = useState<CropPreset | null>(null);
  const [altOpen, setAltOpen] = useState(false);

  // Measure the editor content column so images cap at its width and Full works.
  useEffect(() => {
    const col = rootRef.current?.closest('.ProseMirror') as HTMLElement | null;
    if (!col) return;
    const update = () => setContainerW(col.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(col);
    return () => ro.disconnect();
  }, []);

  const imageAR = natural ? natural.w / natural.h : 1;
  const maxW = containerW || 680;

  // Effective display width of the (cropped) image in normal mode.
  const naturalCropW = natural ? crop.cropW * natural.w : 0;
  const baseW = fullWidth
    ? maxW
    : width != null
    ? Math.min(width, maxW)
    : natural
    ? Math.min(naturalCropW, maxW)
    : maxW;
  const W = liveWidth != null ? liveWidth : baseW;

  const geo = frameGeometry(W, imageAR, crop);
  const rot = ((rotate % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const rotatorW = swap ? geo.frameHeight : geo.frameWidth;
  const rotatorH = swap ? geo.frameWidth : geo.frameHeight;

  // ─── Drag controller (resize + crop), rAF-throttled ──────────────────────────
  const flush = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (liveWidthRef.current != null) setLiveWidth(liveWidthRef.current);
      if (cropPxRef.current) setCropPx({ ...cropPxRef.current });
    });
  };

  const handleMove = (clientX: number, clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'resize') {
      const dx = clientX - d.startX;
      const dy = clientY - d.startY;
      let delta = 0;
      if (d.id.includes('e')) delta = dx;
      else if (d.id.includes('w')) delta = -dx;
      else if (d.id === 's') delta = dy * d.ratio;
      else if (d.id === 'n') delta = -dy * d.ratio;
      liveWidthRef.current = clamp(d.startW + delta, MIN_IMAGE_WIDTH, d.maxW);
      flush();
    } else if (d.kind === 'cropmove') {
      const dx = clientX - d.startX;
      const dy = clientY - d.startY;
      cropPxRef.current = {
        ...d.rect,
        x: clamp(d.rect.x + dx, 0, d.dispW - d.rect.w),
        y: clamp(d.rect.y + dy, 0, d.dispH - d.rect.h),
      };
      flush();
    } else if (d.kind === 'crophandle') {
      const dx = clientX - d.startX;
      const dy = clientY - d.startY;
      let left = d.rect.x;
      let top = d.rect.y;
      let right = d.rect.x + d.rect.w;
      let bottom = d.rect.y + d.rect.h;
      if (d.id.includes('w')) left = clamp(d.rect.x + dx, 0, right - CROP_MIN);
      if (d.id.includes('e')) right = clamp(right + dx, left + CROP_MIN, d.dispW);
      if (d.id.includes('n')) top = clamp(d.rect.y + dy, 0, bottom - CROP_MIN);
      if (d.id.includes('s')) bottom = clamp(bottom + dy, top + CROP_MIN, d.dispH);
      cropPxRef.current = { x: left, y: top, w: right - left, h: bottom - top };
      setActivePreset('custom');
      flush();
    }
  };

  const handleUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.kind === 'resize') {
      const w = liveWidthRef.current;
      liveWidthRef.current = null;
      setLiveWidth(null);
      if (w != null) updateAttributes({ width: Math.round(w), fullWidth: false });
    }
  };

  const beginDrag = (snapshot: DragState) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = snapshot;
    const move = (ev: PointerEvent) => handleMove(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      handleUp();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ─── Crop mode ───────────────────────────────────────────────────────────────
  const enterCrop = () => {
    if (!natural) return;
    const w = Math.min(natural.w, maxW);
    const h = w / imageAR;
    const px = cropToPixels(crop, w, h);
    cropDispRef.current = { w, h };
    cropPxRef.current = px;
    setCropDisp({ w, h });
    setCropPx(px);
    setActivePreset(crop.cropW === 1 && crop.cropH === 1 ? 'full' : 'custom');
    setCropping(true);
  };

  const applyCrop = () => {
    const px = cropPxRef.current;
    const disp = cropDispRef.current;
    if (px && disp) updateAttributes({ ...pixelsToCrop(px, disp.w, disp.h), round: activePreset === 'circle' });
    setCropping(false);
  };
  const cancelCrop = () => setCropping(false);

  const applyPreset = (preset: CropPreset) => {
    const disp = cropDispRef.current;
    if (!disp) return;
    const c = presetToCrop(preset, imageAR, pixelsToCrop(cropPxRef.current || cropToPixels(crop, disp.w, disp.h), disp.w, disp.h));
    const px = cropToPixels(c, disp.w, disp.h);
    cropPxRef.current = px;
    setCropPx(px);
    setActivePreset(preset);
  };

  // Keyboard: Esc cancel · Enter apply · arrows nudge (while cropping).
  useEffect(() => {
    if (!cropping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelCrop(); return; }
      if (e.key === 'Enter') { e.preventDefault(); applyCrop(); return; }
      if (e.key.startsWith('Arrow')) {
        const px = cropPxRef.current;
        const disp = cropDispRef.current;
        if (!px || !disp) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const nx = clamp(px.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), 0, disp.w - px.w);
        const ny = clamp(px.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0), 0, disp.h - px.h);
        cropPxRef.current = { ...px, x: nx, y: ny };
        setCropPx({ ...px, x: nx, y: ny });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropping]);

  // ─── Toolbar actions ─────────────────────────────────────────────────────────
  const rotateBy = (deg: number) => updateAttributes({ rotate: (((rotate + deg) % 360) + 360) % 360 });
  const resetCrop = () => updateAttributes({ cropX: 0, cropY: 0, cropW: 1, cropH: 1, round: false });
  const originalSize = () => updateAttributes({ width: null, fullWidth: false });
  const setSize = (key: 'small' | 'medium' | 'large' | 'full') =>
    key === 'full'
      ? updateAttributes({ fullWidth: true })
      : updateAttributes({ width: WIDTH_PRESETS[key], fullWidth: false });

  const onReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { window.alert('Please choose an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { window.alert('Image is too large — 2 MB max'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setNatural(null);
      updateAttributes({ src: reader.result as string, alt: file.name, cropX: 0, cropY: 0, cropW: 1, cropH: 1, rotate: 0, flipH: false, flipV: false, round: false });
    };
    reader.readAsDataURL(file);
  };

  const onDownload = () => {
    const img = fullImgRef.current;
    if (!img) return;
    const a2 = document.createElement('a');
    a2.href = rasterize(img, crop, rotate, flipH, flipV);
    a2.download = `${alt || 'image'}.png`;
    a2.click();
  };

  const selectSelf = () => {
    if (!isEditable) return;
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos != null) editor.commands.setNodeSelection(pos);
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const IBtn = ({ label, onClick, active, danger, children }: {
    label: string; onClick: () => void; active?: boolean; danger?: boolean; children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...(active !== undefined ? { 'aria-pressed': active } : {})}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`img-tool-btn${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}`}
    >
      {children}
    </button>
  );

  const frameStyle: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: geo.frameWidth,
    height: geo.frameHeight,
    transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
    borderRadius: round ? '50%' : 10,
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`image-node${selected ? ' is-selected' : ''}${cropping ? ' is-cropping' : ''}`}
      data-align={align}
      data-wrap={wrap}
    >
      <div ref={rootRef} className="image-node-inner" style={{ width: cropping && cropDisp ? cropDisp.w : rotatorW }}>
        {cropping && cropDisp ? (
          /* ── Inline crop mode ───────────────────────────────────────────── */
          <div className="image-crop-stage" style={{ width: cropDisp.w, height: cropDisp.h }} onPointerDown={stop}>
            <img src={src} alt="" draggable={false} className="image-crop-src" style={{ width: cropDisp.w, height: cropDisp.h }} />
            {cropPx && (
              <div
                className={`image-crop-rect${activePreset === 'circle' ? ' is-round' : ''}`}
                style={{ left: cropPx.x, top: cropPx.y, width: cropPx.w, height: cropPx.h }}
                onPointerDown={(e) => beginDrag({ kind: 'cropmove', startX: e.clientX, startY: e.clientY, rect: cropPxRef.current!, dispW: cropDisp.w, dispH: cropDisp.h })(e)}
              >
                <div className="image-crop-guides" aria-hidden>
                  <span className="v1" /><span className="v2" /><span className="h1" /><span className="h2" />
                </div>
                {HANDLES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    aria-label={`Crop ${h.label}`}
                    className="image-handle"
                    style={{ left: h.cx, top: h.cy, cursor: h.cursor }}
                    onPointerDown={(e) => {
                      const disp = cropDispRef.current!;
                      beginDrag({ kind: 'crophandle', id: h.id, startX: e.clientX, startY: e.clientY, rect: cropPxRef.current!, dispW: disp.w, dispH: disp.h })(e);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Normal display ─────────────────────────────────────────────── */
          <div className={`image-rotator${selected ? ' is-selected' : ''}`} style={{ width: rotatorW, height: rotatorH }} onClick={selectSelf}>
            <div className="image-frame" style={frameStyle}>
              <img
                ref={fullImgRef}
                src={src}
                alt={alt}
                title={a.title || undefined}
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  if (el.naturalWidth) setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                }}
                style={{ width: geo.innerWidth, height: 'auto', marginLeft: geo.offsetLeft, marginTop: geo.offsetTop, maxWidth: 'none', display: 'block' }}
              />
            </div>

            {selected && isEditable && (
              <>
                {HANDLES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    aria-label={`Resize ${h.label}`}
                    className="image-handle"
                    style={{ left: h.cx, top: h.cy, cursor: h.cursor }}
                    onPointerDown={(e) => beginDrag({ kind: 'resize', id: h.id, startX: e.clientX, startY: e.clientY, startW: W, ratio: geo.frameWidth / Math.max(1, geo.frameHeight), maxW })(e)}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Floating toolbar */}
        {selected && isEditable && (
          <div className="image-toolbar" role="toolbar" aria-label="Image tools" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={stop}>
            {cropping ? (
              <div className="image-toolbar-row">
                <div className="image-preset-bar">
                  {PRESETS.map((p) => (
                    <button key={p.id} type="button" className={`img-preset${activePreset === p.id ? ' is-active' : ''}`}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.stopPropagation(); applyPreset(p.id); }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <span className="img-tool-sep" />
                <IBtn label="Apply crop (Enter)" onClick={applyCrop} active><IcCheck /></IBtn>
                <IBtn label="Cancel (Esc)" onClick={cancelCrop} danger><IcClose /></IBtn>
              </div>
            ) : (
              <>
                <div className="image-toolbar-row">
                  <IBtn label="Crop" onClick={enterCrop}><IcCrop /></IBtn>
                  <IBtn label="Rotate left" onClick={() => rotateBy(-90)}><IcRotateL /></IBtn>
                  <IBtn label="Rotate right" onClick={() => rotateBy(90)}><IcRotateR /></IBtn>
                  <IBtn label="Flip horizontal" onClick={() => updateAttributes({ flipH: !flipH })} active={flipH}><IcFlipH /></IBtn>
                  <IBtn label="Flip vertical" onClick={() => updateAttributes({ flipV: !flipV })} active={flipV}><IcFlipV /></IBtn>
                  <span className="img-tool-sep" />
                  <IBtn label="Replace image" onClick={() => fileRef.current?.click()}><IcReplace /></IBtn>
                  <IBtn label="Alt text" onClick={() => setAltOpen((v) => !v)} active={altOpen}><IcAlt /></IBtn>
                  <IBtn label="Download" onClick={onDownload}><IcDownload /></IBtn>
                  <IBtn label="Delete" onClick={deleteNode} danger><IcTrash /></IBtn>
                </div>
                <div className="image-toolbar-row">
                  <IBtn label="Align left" onClick={() => updateAttributes({ align: 'left', wrap: 'none' })} active={wrap === 'none' && align === 'left'}><IcAlignL /></IBtn>
                  <IBtn label="Align center" onClick={() => updateAttributes({ align: 'center', wrap: 'none' })} active={wrap === 'none' && align === 'center'}><IcAlignC /></IBtn>
                  <IBtn label="Align right" onClick={() => updateAttributes({ align: 'right', wrap: 'none' })} active={wrap === 'none' && align === 'right'}><IcAlignR /></IBtn>
                  <span className="img-tool-sep" />
                  <IBtn label="Wrap text left" onClick={() => updateAttributes({ wrap: 'left' })} active={wrap === 'left'}><IcWrapL /></IBtn>
                  <IBtn label="Wrap text right" onClick={() => updateAttributes({ wrap: 'right' })} active={wrap === 'right'}><IcWrapR /></IBtn>
                  <span className="img-tool-sep" />
                  <button type="button" className="img-size-btn" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); setSize('small'); }}>S</button>
                  <button type="button" className="img-size-btn" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); setSize('medium'); }}>M</button>
                  <button type="button" className="img-size-btn" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); setSize('large'); }}>L</button>
                  <button type="button" className={`img-size-btn${fullWidth ? ' is-active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); setSize('full'); }}>Full</button>
                  <span className="img-tool-sep" />
                  <IBtn label="Reset crop" onClick={resetCrop}><IcReset /></IBtn>
                  <IBtn label="Original size" onClick={originalSize}><IcOriginal /></IBtn>
                </div>
              </>
            )}
          </div>
        )}

        {/* Alt-text popover */}
        {altOpen && selected && (
          <div className="image-alt-popover" onMouseDown={stop} onClick={stop}>
            <label className="image-alt-label">Alt text (for screen readers)</label>
            <input
              className="image-alt-input"
              value={alt}
              placeholder="Describe this image…"
              onChange={(e) => updateAttributes({ alt: e.target.value })}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setAltOpen(false); }}
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Caption — simple single-line field, shown when selected or already set */}
      {!cropping && (selected || caption) && (
        <input
          className="image-caption"
          value={caption}
          placeholder={isEditable ? 'Add a caption…' : ''}
          readOnly={!isEditable}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
          onMouseDown={stop}
          onKeyDown={stop}
          aria-label="Image caption"
        />
      )}

      {/* Hidden input backing Replace */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" tabIndex={-1} title="Replace image file" aria-label="Replace image file" onChange={onReplaceFile} />
    </NodeViewWrapper>
  );
}

/* ── Icons (16px, stroke-based) ──────────────────────────────────────────────── */
const S = (p: React.SVGProps<SVGSVGElement>) => ({ width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p });
const IcCrop = () => (<svg {...S({})}><path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14" /></svg>);
const IcRotateL = () => (<svg {...S({})}><path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" /></svg>);
const IcRotateR = () => (<svg {...S({})}><path d="M21 12a9 9 0 1 1-3-6.7L21 8m0-5v5h-5" /></svg>);
const IcFlipH = () => (<svg {...S({})}><path d="M12 3v18M7 8l-4 4 4 4M17 8l4 4-4 4" /></svg>);
const IcFlipV = () => (<svg {...S({})}><path d="M3 12h18M8 7 12 3l4 4M8 17l4 4 4-4" /></svg>);
const IcReplace = () => (<svg {...S({})}><path d="M3 7h4l2-2h6l2 2h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>);
const IcAlt = () => (<svg {...S({})}><path d="M4 5h16v14H4zM8 15l2.5-5 2.5 5M9 13h3M16 10v5" /></svg>);
const IcDownload = () => (<svg {...S({})}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" /></svg>);
const IcTrash = () => (<svg {...S({})}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>);
const IcCheck = () => (<svg {...S({})}><path d="M4 12l5 5L20 6" /></svg>);
const IcClose = () => (<svg {...S({})}><path d="M6 6l12 12M18 6 6 18" /></svg>);
const IcReset = () => (<svg {...S({})}><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7 3.3M3 3v4h4" /></svg>);
const IcOriginal = () => (<svg {...S({})}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>);
const IcAlignL = () => (<svg {...S({})}><path d="M3 5h18M3 10h10M3 14h18M3 19h10" /></svg>);
const IcAlignC = () => (<svg {...S({})}><path d="M3 5h18M6 10h12M3 14h18M6 19h12" /></svg>);
const IcAlignR = () => (<svg {...S({})}><path d="M3 5h18M11 10h10M3 14h18M11 19h10" /></svg>);
const IcWrapL = () => (<svg {...S({})}><path d="M3 5h8v8H3zM14 6h7M14 10h7M3 17h18M3 21h18" /></svg>);
const IcWrapR = () => (<svg {...S({})}><path d="M13 5h8v8h-8zM3 6h7M3 10h7M3 17h18M3 21h18" /></svg>);
