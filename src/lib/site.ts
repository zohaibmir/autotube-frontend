/**
 * Single source of truth for the public identity of the site.
 *
 * Why this file exists
 * --------------------
 * `SUPPORT_EMAIL` was hardcoded in eight places across six files, and the legal
 * entity name in three more. They have already drifted once: `.env` delivers the
 * contact form to a working inbox while every page told users to email
 * `support@vidora.ai`, a domain with no MX records. So a user whose submission
 * failed was told to email an address that silently bounces -- and a GDPR erasure
 * request sent there would never arrive.
 *
 * Centralising it means changing the address is one line, not a hunt through JSX.
 *
 * ⚠️  `SUPPORT_EMAIL` must match `SUPPORT_EMAIL` in the backend `.env`, which is
 * what actually receives the contact form. It cannot be fetched at runtime --
 * the legal pages are static and must render without an API call -- so
 * `scripts/test_support_email_consistency.py` fails if the two drift.
 *
 * The marketing domain is separate from the app domain and both matter:
 * `SITE_URL` is canonical for SEO/OG, while the app is served from
 * `FRONTEND_URL`. See `MANUAL_ACTIONS.md` §B6 for the CORS consequence.
 */

export const SITE_NAME = 'Vidora'

/** Canonical public domain. Used for canonical tags, OG URLs and sitemap entries. */
export const SITE_URL = __MARKETING_ORIGIN__
export const SITE_INDEXABLE = __SITE_INDEXABLE__

/** Where support, refund and GDPR-rights mail is read. See A1 in MANUAL_ACTIONS.md. */
export const SUPPORT_EMAIL = 'support@vidora.ai'

/** Ready-made href for the support address. */
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`

/**
 * Sales / plan-enquiry address, used by the Enterprise and Agency CTAs on the
 * billing page. Kept separate from `SUPPORT_EMAIL` because it is a different
 * conversation -- but it sits on the same domain, so it fails for exactly the
 * same reason if that domain has no MX records. See A1 in MANUAL_ACTIONS.md.
 */
export const SALES_EMAIL = 'hello@vidora.ai'

/** Ready-made href for the sales address, mirroring SUPPORT_MAILTO. */
export const SALES_MAILTO = `mailto:${SALES_EMAIL}`

/**
 * Trader identity. Swedish/EU e-commerce law requires the trader's name,
 * registration number and registered office to be easily accessible before
 * purchase, which is why these appear in the footer as well as the legal pages.
 */
export const LEGAL_ENTITY = 'Rihla AB'
export const LEGAL_ENTITY_ORG_NR = '559589-5656'
export const LEGAL_ENTITY_FULL =
  `${LEGAL_ENTITY}, org.nr ${LEGAL_ENTITY_ORG_NR}, Sollentuna, Sweden`
