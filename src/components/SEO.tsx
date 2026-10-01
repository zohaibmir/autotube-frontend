import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'Channelpilot'
const SITE_URL = 'https://channelpilot.io' // canonical production domain - update if the real domain differs
const DEFAULT_DESCRIPTION =
  'Channelpilot turns one topic into a fully produced, multi-platform video - script, voiceover, visuals, and upload - handled by AI. Publish more, edit less.'
const DEFAULT_OG_TITLE = `${SITE_NAME} - AI YouTube Automation`

export interface SEOProps {
  /** Page-specific title. Rendered as "{title} | Channelpilot" unless noSuffix is set. */
  title: string
  description?: string
  /** Path only, e.g. "/pricing" or "/blog/my-post" - combined with SITE_URL for canonical + OG url. */
  path?: string
  /** Render `title` as-is without the " | Channelpilot" suffix (used for the Home page). */
  noSuffix?: boolean
  /** Raw JSON-LD structured data object(s) to embed as <script type="application/ld+json">. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
  /** Set to true on pages that shouldn't be indexed (none currently, kept for completeness). */
  noIndex?: boolean
}

/**
 * Per-page SEO tags (title, meta description, canonical, Open Graph, Twitter Card,
 * optional JSON-LD structured data). React Router is a client-rendered SPA, so
 * without this every route would share the single static <title>/<meta> pair
 * baked into index.html - this gives each page its own, which matters for both
 * search indexing and how links look when shared (Slack, Twitter, iMessage, etc).
 */
export default function SEO({ title, description, path, noSuffix, jsonLd, noIndex }: SEOProps) {
  const fullTitle = noSuffix ? title : `${title} | ${SITE_NAME}`
  const desc = description || DEFAULT_DESCRIPTION
  const url = path ? `${SITE_URL}${path}` : SITE_URL
  const jsonLdList = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={noSuffix ? title : `${title} - ${SITE_NAME}`} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={noSuffix ? title : `${title} - ${SITE_NAME}`} />
      <meta name="twitter:description" content={desc} />

      {jsonLdList.map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  )
}

export { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION, DEFAULT_OG_TITLE }
