# React + Vite

## SEO and Vercel builds

`npm run build` now prerenders the public React routes and blog posts into
`dist/`, and emits a Vercel Build Output API deployment in `.vercel/output/`.
The same route definitions drive the browser, prerenderer, sitemap, and Vercel
routing. No new framework or browser installation is required to build.

In Vercel, set the project **Root Directory** to `frontend/app`, use the committed
`vercel.json`, and remove any dashboard Output Directory override or catch-all
SPA rewrite. The Build Output API supplies the deployment's routing rules.

SEO is **off by default** while the domain is undecided:

```dotenv
VITE_MARKETING_ORIGIN=
VITE_SITE_INDEXABLE=false
```

To enable public indexing after selecting, connecting, and verifying the new
domain, set these in Vercel's **Production** environment and rebuild:

```dotenv
VITE_MARKETING_ORIGIN=https://www.your-new-domain.com
VITE_SITE_INDEXABLE=true
```

The origin must be HTTPS with no path, query, fragment, or credentials. Missing
or invalid origins fail the build when indexing is requested. Preview and Vercel
Development builds always emit noindex headers and an empty sitemap. Only the
configured canonical host avoids the production host-level noindex header.
Configure alternate-host redirects and TLS in Vercel's Domains settings once
the domain is known.

Public pages ship route-specific titles, descriptions, social cards, canonical
URLs and existing JSON-LD in their initial HTML, then hydrate normally. Without
an origin, no canonical or OG URL is emitted. Builds generate a distinct 1200x630
PNG card for each public page, plus a 48px favicon and a 192px brand logo.
`sharp` checks card dimensions, headline fit and the 120KB size ceiling.
Inter and Lora variable fonts are self-hosted; their SIL OFL licenses ship under
`dist/font-licenses/`. No Google Fonts requests are needed.

Vercel serves `/app/*` and the four auth routes from a noindex SPA shell. Public
unknown URLs, including unknown blog slugs, get a 404 page with HTTP 404. Analyzer
`?url=` and `?v=` results get noindex headers and retain the clean tool canonical.
The sitemap includes all public routes (including legal pages), never private
routes, and is empty while indexing is off. `robots.txt` allows crawling so bots
can actually read the noindex directives.

Validation (no backend, credentials, or external requests needed):

```bash
npm ci --legacy-peer-deps
npx playwright install chromium firefox
npm run test:seo:config
npm run build
npm run test:seo
npm run audit:performance
npm run type-check
```

Use Node **22.19+** for the Lighthouse/axe audit tools. The existing React
19/Stripe peer mismatch requires `--legacy-peer-deps`; Stripe was not upgraded
as part of SEO work.

`npm run test:seo` uses a dedicated production-preview server, not the normal
backend-dependent E2E configuration. `vite preview` verifies generated HTML and
hydration but does not emulate Vercel's response headers, redirects, or status
codes; those generated routing rules have focused Node tests and still require
a post-deploy Vercel smoke test.

The Chromium/Firefox suite includes axe WCAG 2.2 AA/best-practice checks on all
48 public pages, representative layout checks at 320/375/768px, mobile-menu
keyboard checks and on-demand authentication/dashboard loading. Mocked analyzer
success/rate-limit/server-error states and contact-form failure/stored-message
states are checked without contacting providers. Automated checks do not replace
manual assistive-technology or real-device testing.

Every build writes `performance-results/bundle.json`, measuring each public
template's entry JS, lazy page chunk and recursive static imports. Budgets use
the worst public template, not just the entry. Browser tests cross-check actual
script requests on Home, Pricing and an article. The report also includes the
bare entry, largest module contributions and consent-delayed Replay files.
It also counts the small inlined consent bootstrap. The banner is prerendered;
that script uses the shared consent validator to hide saved decisions before
paint, without making new visitors wait for hydration to see the choice.
Each prerendered page preloads its own module graph to avoid a hydration waterfall.
Public/private pages are lazy-loaded; a public route does not need dashboard
or authentication chunks. Sentry monitoring/tracing remains enabled when
configured; Replay code downloads only after consent. Reports are ignored and
are not deployed.

`npm run audit:performance` starts its own strict-port localhost preview on
4181 and uses Playwright's installed Chromium for three cold mobile Lighthouse
runs per route: Home, Pricing, SEO Analyzer and one real article. External
font/provider requests are blocked. It retains individual JSON reports and
median results in `performance-results/summary.json`, then closes its server
and browsers.

Budgets: initial JS <= **570,000 bytes**, gzip JS <= **175,000 bytes**, median
lab LCP <= **2,500 ms**, median lab CLS <= **0.1**. Scores and TBT are reported,
not gated; TBT does not measure INP. Public splitting and two-pass Terser
compression preserve the JS budgets even in the locally tested telemetry build.
The latest telemetry-enabled Home median LCP is **0.770s**, down from the earlier
2.525s failure. All four sampled templates and the JS/CLS gates now pass with
unchanged thresholds. These are local results with a reserved dummy DSN, not
proof of deployed performance or a reason to skip launch validation.
Run the audit again with the real production configuration and on the eventual
live deployment; localhost measurements do not establish field Core Web Vitals.

The frontend CI job uses Node 22, installs Chromium and Firefox, runs these checks and
uploads audit/test reports for 14 days. Its noindex configuration needs no
domain or secrets. A reserved `.example` Sentry DSN includes telemetry code in
budgets and exercises consent-gated Replay; browser/audit requests to providers
are blocked. GitHub execution still needs verification after pushing.

The full rollout and remaining work are in
[the SEO implementation guide](../../SEO_IMPLEMENTATION_GUIDE.md). DNS, OAuth,
support/sales email addresses, API CORS, Search Console, field Core Web Vitals,
live social previews and earned backlinks still require their own rollout.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
