/**
 * Thumbnail overlay compositor.
 *
 * Why this exists
 * ---------------
 * The create wizard *previewed* a title overlay as a DOM element and then uploaded the bare
 * background: nothing composited the text, so the overlay the user saw never reached YouTube, and
 * the automated render path (`thumbnail.py`) baked its own unrelated style (90px yellow, top-left).
 * The preview and the uploaded file disagreed either way, and there was nothing to configure
 * because none of it was real.
 *
 * This composes the overlay into the image, so the preview and the uploaded file are the same
 * pixels, and the styling (family, size, colour, outline, shadow, alignment, position) belongs to
 * the user.
 *
 * The layout maths lives in pure helpers that take a `measure` callback: this app has no JS test
 * runner (verification is `tsc` plus Playwright), and a pure function is the only part that can be
 * reasoned about without a browser.
 */

export type OverlayFontKey = 'sans' | 'display' | 'condensed' | 'serif' | 'mono'

export interface OverlayFont {
  key: OverlayFontKey
  label: string
  /** A stack, not a webfont: an unloaded font would change the measured width and wrap differently. */
  stack: string
}

export const OVERLAY_FONTS: OverlayFont[] = [
  { key: 'display', label: 'Display — Impact / Arial Black', stack: '"Arial Black", Impact, sans-serif' },
  { key: 'sans', label: 'Sans — Arial / Helvetica', stack: 'Arial, Helvetica, sans-serif' },
  { key: 'condensed', label: 'Condensed — Arial Narrow', stack: '"Arial Narrow", "Helvetica Neue", sans-serif' },
  { key: 'serif', label: 'Serif — Georgia / Times', stack: 'Georgia, "Times New Roman", serif' },
  { key: 'mono', label: 'Mono — Courier', stack: '"Courier New", Courier, monospace' },
]

/** One-click colours that read well over a photograph. */
export const OVERLAY_COLORS = ['#FFDC32', '#FFFFFF', '#FF3B30', '#34C759', '#22D3EE', '#7C6DFA', '#0A0A0A']

export type OverlayAlign = 'left' | 'center'
export type OverlayPosition = 'top' | 'middle' | 'bottom'

export interface OverlayStyle {
  text: string
  fontKey: OverlayFontKey
  /** px at the composition size (1280×720), so a value means the same thing on every screen. */
  fontSize: number
  color: string
  uppercase: boolean
  bold: boolean
  /** Outline thickness in px; YouTube's own thumbnails lean on this to stay legible. */
  strokeWidth: number
  strokeColor: string
  shadow: boolean
  align: OverlayAlign
  position: OverlayPosition
  /** Dark gradient strip behind the text, so it stays readable over a busy background. */
  bar: boolean
}

export const DEFAULT_OVERLAY_STYLE: OverlayStyle = {
  text: '',
  fontKey: 'display',
  fontSize: 92,
  color: '#FFDC32',
  uppercase: true,
  bold: true,
  strokeWidth: 6,
  strokeColor: '#000000',
  shadow: true,
  align: 'left',
  position: 'middle',
  bar: true,
}

export const THUMB_W = 1280
export const THUMB_H = 720
/** Composition-space margin; also the reference for how wide a line of text may get. */
export const THUMB_PADDING = 60
const MAX_LINES = 3

export function fontStack(key: OverlayFontKey): string {
  return (OVERLAY_FONTS.find(f => f.key === key) ?? OVERLAY_FONTS[0]).stack
}

export function cssFont(style: Pick<OverlayStyle, 'fontKey' | 'fontSize' | 'bold'>): string {
  return `${style.bold ? 'bold ' : ''}${Math.round(style.fontSize)}px ${fontStack(style.fontKey)}`
}

/**
 * Break `text` into at most `MAX_LINES` lines that each fit `maxWidth`, per `measure`.
 * The last line is clipped rather than allowed to overflow, since a thumbnail cannot show more.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (candidate: string) => number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && measure(candidate) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)

  if (lines.length > MAX_LINES) {
    const kept = lines.slice(0, MAX_LINES)
    kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1]}…`
    return kept
  }
  return lines
}

/** Top edge of the text block for a given position, in canvas coordinates. */
export function blockTop(
  position: OverlayPosition,
  blockHeight: number,
  canvasHeight: number = THUMB_H,
  padding: number = THUMB_PADDING,
): number {
  if (position === 'top') return padding
  if (position === 'bottom') return Math.max(padding, canvasHeight - padding - blockHeight)
  return Math.round((canvasHeight - blockHeight) / 2)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the background image'))
    img.src = src
  })
}

/** Draw `img` to cover the canvas, the way a CSS `object-fit: cover` would, centred. */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number = THUMB_W,
  h: number = THUMB_H,
): void {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

/**
 * Compose `background` with `style` and return a JPEG data URL — the same bytes the wizard preview
 * shows and the pipeline uploads. No `document.fonts.ready` wait: the stacks are system fonts, so
 * measuring them immediately is correct, and waiting would only let a webfont change the wrap.
 */
export async function composeThumbnail(
  background: string,
  style: OverlayStyle,
  size: { w: number; h: number } = { w: THUMB_W, h: THUMB_H },
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot compose an overlay (no canvas support)')

  drawCover(ctx, await loadImage(background), size.w, size.h)

  const text = (style.uppercase ? style.text.toUpperCase() : style.text).trim()
  if (text) {
    ctx.font = cssFont(style)
    const lines = wrapLines(
      text,
      size.w - THUMB_PADDING * 2,
      (candidate) => ctx.measureText(candidate).width,
    )
    const lineHeight = Math.round(style.fontSize * 1.12)
    const blockHeight = lines.length * lineHeight
    const top = blockTop(style.position, blockHeight, size.h)
    const x = style.align === 'center' ? size.w / 2 : THUMB_PADDING

    if (style.bar) {
      const barPad = Math.round(style.fontSize * 0.35)
      const gradient = ctx.createLinearGradient(0, top - barPad, 0, top + blockHeight + barPad)
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(0.5, 'rgba(0,0,0,0.55)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, top - barPad, size.w, blockHeight + barPad * 2)
    }

    ctx.textAlign = style.align === 'center' ? 'center' : 'left'
    ctx.textBaseline = 'top'
    ctx.shadowColor = style.shadow ? 'rgba(0,0,0,0.75)' : 'transparent'
    ctx.shadowBlur = style.shadow ? Math.max(6, style.strokeWidth * 2) : 0
    ctx.shadowOffsetY = style.shadow ? Math.max(2, Math.round(style.strokeWidth / 2)) : 0

    lines.forEach((line, index) => {
      const y = top + index * lineHeight
      if (style.strokeWidth > 0) {
        // Outline first: filling over it would hide it.
        ctx.lineJoin = 'round'
        ctx.miterLimit = 2
        ctx.lineWidth = style.strokeWidth
        ctx.strokeStyle = style.strokeColor
        ctx.strokeText(line, x, y)
      }
      ctx.fillStyle = style.color
      ctx.fillText(line, x, y)
    })
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}

