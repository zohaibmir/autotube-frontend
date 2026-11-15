/**
 * What one unit of output costs, and what each plan allows.
 *
 * These numbers are duplicated from the backend deliberately -- the pricing page
 * is static and must render without an API call -- but a duplicate that can drift
 * is a bug, so `scripts/test_marketing_credit_costs.py` fails if anything here
 * disagrees with `core/pricing.RECIPE_CREDITS`, `core/pricing.episode_quote()` or
 * `core/metering.PLAN_CREDITS`.
 *
 * That guard is not hypothetical. This table shipped `short_stock` at **5**
 * credits long after the backend lowered it to **3**, so the Free tier was
 * advertised as buying **8** Shorts when it buys **13**. `core/pricing.py:337`
 * records exactly why the number changed: 5 carried an 89% margin, which
 * overpriced the entry-level action and suppressed activation.
 */

/** `core/metering.PLAN_CREDITS`. `null` means unmetered. */
export const PLAN_CREDITS: Record<string, number | null> = {
  free: 40, // one-time, no rollover
  starter: 300,
  pro: 900,
  studio: 2200,
  agency: 8000,
  enterprise: null,
}

/**
 * `core/pricing.PLAN_CHANNELS` -- the connected-channel allowance. `null` means
 * unlimited.
 *
 * These were hardcoded in three places (PricingPage, HomePage and
 * dashboard/Billing) while `core/pricing.py` claimed those pages read
 * PLAN_CHANNELS. They did not, so what we advertise and what `add_channel`
 * enforces were free to drift apart. `dashboard/Billing.tsx` also falls back to
 * its own copy for the usage bar's "used X of Y", so a drift would misreport a
 * customer's own limit back to them.
 */
export const PLAN_CHANNELS: Record<string, number | null> = {
  free: 1,
  starter: 1,
  pro: 5,
  studio: 10,
  agency: null,
  enterprise: null,
}

/** The count alone -- "1", "5", "Unlimited" -- for a table cell. */
export function channelCount(plan: string): string {
  const n = PLAN_CHANNELS[plan]
  return n == null ? 'Unlimited' : String(n)
}

/** "1 channel" / "5 channels" / "Unlimited channels". */
export function channelPhrase(plan: string, noun = 'channel'): string {
  const n = PLAN_CHANNELS[plan]
  if (n == null) return `Unlimited ${noun}s`
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

/** The allowance as a number, `Infinity` for unlimited (Billing's usage bar). */
export function channelLimit(plan: string): number {
  const n = PLAN_CHANNELS[plan]
  return n == null ? Infinity : n
}

/** `core/pricing.RECIPE_CREDITS` -- the fixed-price recipes. */
export const UNIT_CREDITS = {
  shortStock: 3, // "short_stock"
  longformStock: 20, // "longform_stock"
  longformPremium: 35, // "longform_premium_voice"
  animeScene: 15, // "anime_scene" / "scene_reroll" -- one 5s Kling scene
  byokPlatformFee: 2, // "byok_platform_fee"
} as const

/**
 * An animated episode is **not** a flat price. Its cost is dominated by one Kling
 * clip per generated scene, so it scales with `segments x coverage`, and
 * `core/pricing.episode_quote()` is the single source of truth for the price
 * shown to the user. The same formula runs at completion, so the quote and the
 * charge cannot drift (`core/pricing.py:535`).
 *
 * Quoting the flat `anime_longform` gate of 180 in this table was wrong: that is
 * the up-front affordability gate, not the charge. It also contradicted this
 * page's own prose.
 *
 * A 2-minute episode is 24 segments; these are its real quotes, priced at the
 * resolution the Kling client actually renders (720p by default).
 */
export const ANIMATED_EPISODE = {
  minutes: 2,
  segments: 24,
  defaultCoverage: 0.3,
  /** `episode_quote(24)` -- the recommended ~30% coverage. */
  defaultCredits: 159,
  /** `episode_quote(24, 1.0)` -- every scene animated. */
  fullCredits: 345,
} as const

/** How many of a unit a plan's monthly allowance buys. */
export function perMonth(
  plan: keyof typeof PLAN_CREDITS | string,
  unitCredits: number,
): number {
  const allowance = PLAN_CREDITS[plan]
  if (allowance == null || unitCredits <= 0) return 0
  return Math.floor(allowance / unitCredits)
}
