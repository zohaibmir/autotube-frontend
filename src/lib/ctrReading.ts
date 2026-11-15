/**
 * Rendering a captured click-through reading (§5.1).
 *
 * The caution this module exists to keep in one place: click-through is the only figure on either video
 * table that is **not** a window. Views and watch time are synced over a period; a CTR reading is
 * cumulative since publication. Styled identically and sitting in the same row, they read as comparable
 * — and a creator who takes "2%" as "this week's click-through" beside "340 views this week" has been
 * misled by layout rather than by a wrong number.
 *
 * Hence three things together: the cell carries the date it was read, the tooltip says which kind of
 * number it is, and a missing reading renders as an em dash. It is deliberately **not** rendered as
 * `0.00%` — capture is opt-in and per-video, so most rows have no reading at all, and a zero there
 * would be a confident claim about a video nobody measured.
 */

export const CTR_COLUMN_NOTE =
  'Read from your own YouTube Studio by the browser extension. Unlike views, this is a lifetime figure ' +
  'since publication, not a window.'

/** `'4.25%'` when there is a reading, `'—'` when there is not. Never `'0.00%'` for a gap. */
export function fmtCtr(value: unknown): string {
  return value === null || value === undefined ? '—' : `${Number(value).toFixed(2)}%`
}

/** `'as of 16 Oct'` — the visible half of the "this is cumulative" caution. Empty when undated. */
export function ctrAsOf(capturedAt: unknown): string {
  if (!capturedAt) return ''
  return `as of ${new Date(String(capturedAt))
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
}

/** The hover half: how many impressions it was measured on, when, and which kind of number it is. */
export function ctrTooltip(v: { ctr_impressions?: unknown; ctr_captured_at?: unknown }): string {
  const bits = [
    v.ctr_impressions != null ? `${Number(v.ctr_impressions).toLocaleString()} impressions` : null,
    v.ctr_captured_at
      ? `read from your own Studio on ${new Date(String(v.ctr_captured_at))
          .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
      : null,
  ].filter(Boolean)
  return `${bits.length ? bits.join(', ') + '. ' : ''}Cumulative since publication, not a window.`
}
