import { Link } from 'react-router-dom'
import Logo from '@components/Logo'
import { DESTINATIONS } from '@lib/destinations'
import {
  LEGAL_ENTITY_FULL,
  SALES_EMAIL,
  SALES_MAILTO,
  SUPPORT_EMAIL,
  SUPPORT_MAILTO,
} from '@lib/site'

// Every link here resolves. Previously Security, Careers, Docs, API and Support
// were `href="#"`, and Privacy/Terms were dead even though the signup form tells
// users they agree to them.
const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', to: '/how-it-works' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Free SEO Analyzer', to: '/tools/seo-analyzer' },
      { label: 'Browser Extension', to: '/extension' },
      { label: 'FAQ', to: '/faq' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Blog', to: '/blog' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' },
      { label: 'Cookie Policy', to: '/cookies' },
    ],
  },
]

/**
 * Footer for the static/marketing pages.
 *
 * Origin: it had no brand block at all, and its column headings (`font-bold` at
 * 16px) were the same size as the links beneath them, so the three columns read
 * with no hierarchy. Spacing is explicit for the same reason as the header --
 * `tailwind.config.js` doubles spacing keys 0-16.
 *
 * Current shape, and why:
 *   - One step deeper (navy-700) than the closing CTA band it sits directly under
 *     on every page, so the CTA keeps the emphasis instead of the two merging into
 *     a single dark slab.
 *   - Three groups of three to four links. That is the useful ceiling; a longer
 *     set belongs in the header rather than duplicating the sitemap.
 *   - No newsletter and no repeated CTA. Only 3 of 12 real SaaS footers carry one,
 *     and this page's CTA band is immediately above.
 *   - Contact routes and the trader identity are always present: support access is
 *     a footer's real job, and Swedish/EU e-commerce law requires the trader's
 *     registration number to be easily reachable before purchase.
 */
export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-navy-700 text-white">
      {/* Ghost wordmark. The closing CTA band above every page is navy-600, and the
          footer was navy-600 too -- so each page ended in one undifferentiated dark
          slab, which is the "decorated as loudly as the final CTA" mistake. One
          step deeper keeps the CTA dominant while the footer still closes the page. */}
      <p
        aria-hidden="true"
        className="pointer-events-none absolute hidden select-none font-bold text-white/5 lg:block"
        style={{ right: -20, bottom: -34, fontSize: 176, lineHeight: 1, letterSpacing: '-0.055em' }}
      >
        Vidora
      </p>

      <div className="site-container relative" style={{ paddingTop: 64, paddingBottom: 32 }}>
        <div
          className="grid grid-cols-2 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]"
          style={{ columnGap: 32, rowGap: 40 }}
        >
          {/* Brand band: wordmark, promise, and the two real contact routes
              (support, and the sales address the billing page already uses). */}
          <div className="col-span-2 lg:col-span-1">
            <Link to="/" aria-label="Vidora home" className="inline-block">
              <Logo variant="light" size={30} />
            </Link>
            <p className="text-[14px] leading-[1.7] text-sky-200" style={{ marginTop: 16, maxWidth: 300 }}>
              Turn one topic into a finished, publishable video — script, voiceover, visuals and upload, end to end.
            </p>
            <p className="site-footer-heading" style={{ marginTop: 24 }}>Contact</p>
            <ul>
              <li>
                <a href={SUPPORT_MAILTO} className="site-footer-link">{SUPPORT_EMAIL}</a>
              </li>
              <li>
                <a href={SALES_MAILTO} className="site-footer-link">{SALES_EMAIL}</a>
              </li>
            </ul>
          </div>

          {/* A landmark rather than three stray divs. Three groups of three to four
              links is the useful ceiling; anything longer belongs in the header. */}
          <nav
            aria-label="Footer"
            className="col-span-2 grid grid-cols-2 sm:grid-cols-3 lg:col-span-1"
            style={{ columnGap: 32, rowGap: 40 }}
          >
            {COLUMNS.map((column) => (
              <div key={column.heading}>
                <p className="site-footer-heading">{column.heading}</p>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} className="site-footer-link">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* The same list the hero band renders, from the same module, so the two
            cannot disagree about what the product publishes to. Telegram and
            Reddit were live in the pipeline for months without appearing
            anywhere on the marketing site. */}
        <div className="border-t border-white/10" style={{ marginTop: 40, paddingTop: 24 }}>
          <p className="site-footer-heading" style={{ marginBottom: 12 }}>Publishes to</p>
          <div className="flex flex-wrap items-center" style={{ gap: '8px 22px' }}>
            {DESTINATIONS.map((destination) => (
              <span key={destination} className="text-[13px] font-semibold text-white">
                {destination}
              </span>
            ))}
          </div>
        </div>

        <div
          className="border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between"
          style={{ marginTop: 24, paddingTop: 24, gap: 8 }}
        >
          <p className="text-[13px] text-sky-200">
            &copy; {new Date().getFullYear()} Vidora. All rights reserved.
          </p>
          {/* Swedish/EU e-commerce law requires the trader identity and
              registration number to be easily accessible before purchase. */}
          <p className="text-[12.5px] text-sky-200">
            Vidora is a service of {LEGAL_ENTITY_FULL}.
          </p>
        </div>
      </div>
    </footer>
  )
}

