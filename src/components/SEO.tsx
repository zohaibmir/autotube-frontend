import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import { SITE_INDEXABLE, SITE_NAME, SITE_URL } from '@lib/site'
import { socialImagePath } from '@lib/socialImages'

const DEFAULT_DESCRIPTION =
  'Vidora turns one topic into a fully produced, multi-platform video - script, voiceover, visuals, and upload - handled by AI. Publish more, edit less.'
const DEFAULT_OG_TITLE = `${SITE_NAME} - AI YouTube Automation`

export interface SEOProps {
  /** Page-specific title. Rendered as "{title} | Vidora" unless noSuffix is set. */
  title: string
  description?: string
  /** Path only, e.g. "/pricing" or "/blog/my-post" - combined with SITE_URL for canonical + OG url. */
  path?: string
  /** Render `title` as-is without the " | Vidora" suffix (used for the Home page). */
  noSuffix?: boolean
  /** Raw JSON-LD structured data object(s) to embed as <script type="application/ld+json">. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
  /** Set to true on private, authentication, and error pages. */
  noIndex?: boolean
  type?: 'website' | 'article'
}

export default function SEO({ title, description, path, noSuffix, jsonLd, noIndex, type = 'website' }: SEOProps) {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  const isAnalysisResult = path === '/tools/seo-analyzer' && (params.has('url') || params.has('v'))
  const fullTitle = noSuffix ? title : `${title} | ${SITE_NAME}`
  const desc = description || DEFAULT_DESCRIPTION
  const url = SITE_URL && !noIndex ? `${SITE_URL}${path || '/'}` : ''
  const image = `${SITE_URL}${noIndex ? '/og-image.png' : socialImagePath(path)}`
  const jsonLdList = jsonLd && SITE_URL && !noIndex ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []

  return (
    <Helmet>
      <title data-seo="true">{fullTitle}</title>
      <meta data-seo="true" name="description" content={desc} />
      {url && <link data-seo="true" rel="canonical" href={url} />}
      <meta data-seo="true" name="robots" content={!SITE_INDEXABLE || noIndex || isAnalysisResult ? 'noindex, nofollow' : 'index, follow'} />
      <meta data-seo="true" property="og:type" content={type} />
      <meta data-seo="true" property="og:site_name" content={SITE_NAME} />
      <meta data-seo="true" property="og:title" content={fullTitle} />
      <meta data-seo="true" property="og:description" content={desc} />
      {url && <meta data-seo="true" property="og:url" content={url} />}
      <meta data-seo="true" property="og:image" content={image} />
      <meta data-seo="true" property="og:image:type" content="image/png" />
      <meta data-seo="true" property="og:image:width" content="1200" />
      <meta data-seo="true" property="og:image:height" content="630" />
      <meta data-seo="true" property="og:image:alt" content={fullTitle} />
      <meta data-seo="true" name="twitter:card" content="summary_large_image" />
      <meta data-seo="true" name="twitter:title" content={fullTitle} />
      <meta data-seo="true" name="twitter:description" content={desc} />
      <meta data-seo="true" name="twitter:image" content={image} />
      <meta data-seo="true" name="twitter:image:alt" content={fullTitle} />

      {jsonLdList.map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj).replace(/</g, '\\u003c')}
        </script>
      ))}
    </Helmet>
  )
}

export { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION, DEFAULT_OG_TITLE }
