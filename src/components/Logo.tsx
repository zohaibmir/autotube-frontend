import { clsx } from 'clsx'

/**
 * Vidora brand mark — a play glyph on a rounded navy tile.
 *
 * Sizing is explicit (numbers, applied inline) rather than Tailwind utilities on
 * purpose. This project's `tailwind.config.js` overrides `theme.extend.spacing`
 * for keys 0-16 with *doubled* values, so `w-7 h-7` emits 56px and `h-16` emits
 * 128px. Using utilities here would render the mark twice its intended size in
 * the header. Explicit pixels keep the mark identical wherever it appears.
 *
 * The header previously showed a navy square containing the letters "CP" — a
 * leftover initial from an earlier product name — next to the word "Vidora".
 */

type Variant = 'dark' | 'light'

type LogoMarkProps = {
  /** Rendered square size in px. 28 in the header, 32 in the footer. */
  size?: number
  /** `dark` = navy tile for light backgrounds; `light` = white tile for navy. */
  variant?: Variant
  className?: string
}

const TILE: Record<Variant, string> = {
  dark: '#1A3A52',   // navy-600
  light: '#FFFFFF',
}

const GLYPH: Record<Variant, string> = {
  dark: '#FFFFFF',
  light: '#1A3A52',
}

export function LogoMark({ size = 28, variant = 'dark', className }: LogoMarkProps) {
  return (
    <span
      className={clsx('inline-flex flex-shrink-0 items-center justify-center overflow-hidden', className)}
      style={{ width: size, height: size, backgroundColor: TILE[variant], borderRadius: Math.round(size * 0.3) }}
      aria-hidden="true"
    >
      {/* The stroke plus round join is what gives the triangle its rounded
          corners; the shape is nudged right of centre, which is how a play
          glyph is optically centred inside a square. */}
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path
          d="M13 10.5 L22.5 16 L13 21.5 Z"
          fill={GLYPH[variant]}
          stroke={GLYPH[variant]}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

type LogoProps = LogoMarkProps & {
  /** Font size of the "Vidora" wordmark in px. */
  wordmarkSize?: number
  className?: string
  /** Override the wordmark colour, e.g. on a tinted surface. */
  wordmarkClassName?: string
}

export function Logo({ size = 28, variant = 'dark', wordmarkSize = 17, className, wordmarkClassName }: LogoProps) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} variant={variant} />
      <span
        className={clsx(
          'font-semibold leading-none tracking-[-0.02em]',
          variant === 'dark' ? 'text-navy-600' : 'text-white',
          wordmarkClassName,
        )}
        style={{ fontSize: wordmarkSize }}
      >
        Vidora
      </span>
    </span>
  )
}

export default Logo
