/**
 * The publishing destinations Vidora actually supports.
 *
 * Why this file exists
 * --------------------
 * Telegram and Reddit are live in the pipeline -- `social_uploader.py` has listed
 * them in `_PLATFORM_NAMES` since they shipped, `telegram_poster.py` and
 * `reddit_poster.py` are called from `pipeline.py`, and `social_metrics_sync.py`
 * collects metrics for both. Every marketing page, however, still advertised
 * *five* destinations (YouTube, Shorts, Instagram, TikTok, Facebook), so the site
 * under-claimed two shipping integrations -- and multi-platform distribution is
 * the product's main differentiator, so it was the part left out.
 *
 * The same list was then written out by hand in four more files and drifted each
 * time. The FAQ went the other way and promised "X and LinkedIn in Q3 2026": a
 * quarter that has since ended, and a platform (LinkedIn) that has no code, no
 * token registry entry and not even a "coming soon" card in Settings.
 *
 * So the list lives here once, and `scripts/test_marketing_destinations.py` holds
 * it to the backend registry in both directions: every platform the pipeline can
 * post to must be advertised, and nothing that is not implemented -- or at least
 * declared in the Settings roadmap -- may be. Add a platform to `_PLATFORM_NAMES`
 * and this file has to follow.
 *
 * Each entry is a display string; the first word lowercased is the platform key
 * ('Instagram Reels' -> 'instagram'), which is what the guard matches on. See the
 * long-form names in `Settings.tsx::SOCIAL_PLATFORMS` for the same vocabulary.
 */
export const DESTINATIONS = [
  'YouTube',
  'YouTube Shorts',
  'Instagram Reels',
  'TikTok',
  'Facebook Reels',
  'Telegram',
  'Reddit',
] as const

/** Platform keys derived from the labels, so the two cannot disagree. */
export const DESTINATION_KEYS: string[] = DESTINATIONS.map(
  (destination) => destination.split(' ')[0].toLowerCase()
)

/**
 * Rendered as "One pipeline · N destinations" beside the hero band and as the
 * hero stat. Derived, so adding a destination updates every count at once.
 */
export const DESTINATION_COUNT = DESTINATIONS.length
