// Public identity of the browser extension, as content.
//
// Static data module (no CMS/backend) - rendered by ExtensionPage / ExtensionPrivacyPage.
//
// Why this exists rather than the pages restating it: the extension's marketing page, its privacy
// page and `extension/README.md` describe the same feature set, and written separately they drift.
// That drift has already cost real time once - `README.md` and `COMPETITOR_FEATURES_AI_STRATEGY.md`
// §2.9 both claimed two features were "statically verified only" when in fact they had never been
// run at all, and it took a code read to find out. So the feature list lives here.
//
// `tier` is part of the data, not a badge added at render time. Which half of this product is free is
// a product decision that has already changed once, and it should be one edit in one place.

export type ExtensionTier = 'free' | 'byok' | 'account'

export interface ExtensionFeature {
  title: string
  body: string
  tier: ExtensionTier
}

/**
 * The Chrome Web Store listing.
 *
 * Empty until the extension is published, and that is deliberate rather than an oversight. A button
 * pointing at a listing that does not exist turns a curious visitor into a dead end, which is worse
 * than no button at all. While this is empty the pages offer the load-unpacked route instead - which
 * is how the extension genuinely runs today. Setting this one constant turns the primary call to
 * action into a store install everywhere it appears.
 *
 * The submission itself is otherwise ready: `extension/STORE_LISTING.md` holds the copy, the
 * permission justifications and the data-disclosure answers.
 */
export const EXTENSION_STORE_URL = ''

/** True once the listing exists, so the pages can stop offering the developer route. */
export const EXTENSION_IS_PUBLISHED = EXTENSION_STORE_URL.length > 0

/**
 * What the extension does, and what each part costs the user.
 *
 * `byok` is "bring your own key": the suggestions run on the user's own Anthropic key, so giving that
 * away costs us nothing. `account` is the only tier needing a sign-in, and it is the paid product.
 * The split is the whole distribution argument - the free half has to be genuinely useful on its own,
 * or the extension is just an advert.
 */
export const EXTENSION_FEATURES: ExtensionFeature[] = [
  {
    title: 'SEO score for any video',
    body: 'A scored checklist - tags, description length, title length, chapters, category - for any public video, without leaving the page it is on. No account and no sign-in.',
    tier: 'free',
  },
  {
    title: 'Character counters in Studio',
    body: 'Title and description fields get live counts. The 70-character title warning is a review heuristic; displayed truncation depends on device, layout and character widths.',
    tier: 'free',
  },
  {
    title: "Copy any video's tags",
    body: 'See what a competitor actually tagged, and take the list. Useful for research, and it needs nothing from us.',
    tier: 'free',
  },
  {
    title: 'Views per day on search and browse',
    body: 'A lifetime-average views-per-day badge on thumbnails to help compare videos of different ages. It is not a measurement of current daily momentum.',
    tier: 'free',
  },
  {
    title: 'Title and tag suggestions',
    body: 'Written from the video\'s own current title, with a single best pick rather than five you have to choose between. Runs on your own Anthropic key.',
    tier: 'byok',
  },
  {
    title: 'Click-through rate history',
    body: "Reads impressions and click-through out of your own Studio analytics, so a thumbnail change can be judged against the video's own past instead of against a feeling.",
    tier: 'account',
  },
  {
    title: 'Thumbnail A/B testing',
    body: 'Compare sequential thumbnail-rotation windows using captured measurements, including insufficient-data outcomes. This is not YouTube\'s native concurrent watch-time test.',
    tier: 'account',
  },
  {
    title: 'One-click account linking',
    body: 'Connect the extension to your dashboard without copying a token between two different UIs.',
    tier: 'account',
  },
]

/** How each tier is worded, so the pages and the badge cannot disagree. */
export const EXTENSION_TIER_LABELS: Record<ExtensionTier, string> = {
  free: 'Free - no account',
  byok: 'Free - your own AI key',
  account: 'With a Vidora account',
}

/**
 * The Chrome permissions the extension requests, each with the honest reason for it.
 *
 * A store listing has to justify every one of these, and a permission nobody can explain is the
 * fastest way to lose an install. Three, and none of them is "read all your data on all sites".
 */
export const EXTENSION_PERMISSIONS = [
  {
    name: 'activeTab',
    why: 'Read the video you are currently looking at, and only when you ask it to.',
  },
  {
    name: 'storage',
    why: 'Remember your settings, including which of the optional features you have switched on.',
  },
  {
    name: 'contextMenus',
    why: 'Add the right-click "analyze this video" item.',
  },
]

/** Content-script matches; API network hosts are declared separately in the manifest. */
export const EXTENSION_HOSTS = ['studio.youtube.com', 'www.youtube.com']

/**
 * Everything the extension can be made to send, and the switch that governs it.
 *
 * The two optional flows are both **off until switched on**, which is unusual for an extension and
 * the reason this table exists: a visitor deciding whether to install deserves to see the full list
 * rather than a reassuring sentence.
 */
export const EXTENSION_DATA_FLOWS = [
  {
    what: 'Click-through and impression numbers from your Studio analytics',
    when: 'Only if you switch capture on. Off by default.',
    to: 'Our API, authenticated with a scoped token you can revoke from Settings.',
  },
  {
    what: 'The video IDs on the page you are viewing',
    when: 'Only if you switch the views-per-day badges on. Off by default.',
    to: 'Our API. No account or token; sends IDs from the current page, not a browsing-history export.',
  },
  {
    what: "The current title of the video you ask about",
    when: 'Only if you press "Suggest titles & tags".',
    to: 'Our API, which looks the title up server-side rather than scraping it out of the page.',
  },
]

/**
 * What the extension deliberately does not do.
 *
 * Every line here is a decision that was made on purpose, and most of them are things a competitor's
 * extension does do. Stating them is the point: "we did not build that" is a more useful thing for a
 * creator to read than another adjective.
 */
export const EXTENSION_LIMITS = [
  'Its suggestion workflow uses copy buttons rather than auto-filling video fields. This is a product behavior, not a browser-enforced read-only permission.',
  'It captures Studio impressions and click-through only when capture is switched on; it does not collect revenue, audience breakdowns or comments.',
  'It does not track you across the web. It runs on two YouTube hosts and nowhere else.',
  'It ships as inspectable JavaScript without downloaded executable code. A public store listing is not available yet.',
  'It does not read your YouTube password, and it never asks for your Google credentials. Account features use a scoped token you can revoke.',
]

