import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { Route, Routes } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { PUBLIC_PAGES, publicRoute } from './PublicRoutes'
import { BLOG_POSTS } from '@content/blogPosts'
import NotFoundPage from './pages/NotFoundPage'
import CookieBanner from '@components/CookieBanner'

export const PUBLIC_PATHS = [
  ...PUBLIC_PAGES.filter((page) => !page.path.includes(':')).map((page) => page.path),
  ...BLOG_POSTS.map((post) => `/blog/${post.slug}`),
]
const SSR_ROUTES = await Promise.all(PUBLIC_PAGES.map(async (page) => publicRoute(page.path, (await page.load()).default)))

export function renderPage(path: string, shellHead: string) {
  return '<!doctype html>' + renderToString(
    <html lang="en">
      <head dangerouslySetInnerHTML={{ __html: shellHead }} />
      <body>
        <div id="root" data-prerendered="true">
          <HelmetProvider>
            <StaticRouter location={path}>
              <Routes>
                {SSR_ROUTES.map((route) => <Route key={route.path} {...route} />)}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              <CookieBanner />
            </StaticRouter>
          </HelmetProvider>
        </div>
      </body>
    </html>,
  )
}
