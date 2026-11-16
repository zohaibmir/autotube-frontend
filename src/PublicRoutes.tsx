import { lazy, Suspense, type ComponentType } from 'react'

export const PUBLIC_PAGES = [
  { path: '/', source: 'src/pages/HomePage.tsx', load: () => import('./pages/HomePage') },
  { path: '/how-it-works', source: 'src/pages/HowItWorksPage.tsx', load: () => import('./pages/HowItWorksPage') },
  { path: '/pricing', source: 'src/pages/PricingPage.tsx', load: () => import('./pages/PricingPage') },
  { path: '/about', source: 'src/pages/AboutPage.tsx', load: () => import('./pages/AboutPage') },
  { path: '/contact', source: 'src/pages/ContactPage.tsx', load: () => import('./pages/ContactPage') },
  { path: '/faq', source: 'src/pages/FAQPage.tsx', load: () => import('./pages/FAQPage') },
  { path: '/guides/api-keys', source: 'src/pages/ApiKeyGuidesPage.tsx', load: () => import('./pages/ApiKeyGuidesPage') },
  { path: '/blog', source: 'src/pages/BlogListPage.tsx', load: () => import('./pages/BlogListPage') },
  { path: '/blog/:slug', source: 'src/pages/BlogPostPage.tsx', load: () => import('./pages/BlogPostPage') },
  { path: '/tools/seo-analyzer', source: 'src/pages/SeoAnalyzerPage.tsx', load: () => import('./pages/SeoAnalyzerPage') },
  { path: '/extension', source: 'src/pages/ExtensionPage.tsx', load: () => import('./pages/ExtensionPage') },
  { path: '/extension/privacy', source: 'src/pages/ExtensionPrivacyPage.tsx', load: () => import('./pages/ExtensionPrivacyPage') },
  { path: '/terms', source: 'src/pages/TermsPage.tsx', load: () => import('./pages/TermsPage') },
  { path: '/privacy', source: 'src/pages/PrivacyPage.tsx', load: () => import('./pages/PrivacyPage') },
  { path: '/cookies', source: 'src/pages/CookiePolicyPage.tsx', load: () => import('./pages/CookiePolicyPage') },
]

export function publicRoute(path: string, Page: ComponentType) {
  return {
    path,
    element: <Suspense fallback={<main role="status" className="min-h-screen flex items-center justify-center">Loading page...</main>}><Page /></Suspense>,
  }
}

export const PUBLIC_ROUTES = PUBLIC_PAGES.map((page) => publicRoute(page.path, lazy(page.load)))
