import { Link, useParams } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO, { SITE_NAME, SITE_URL } from '@components/SEO'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getPostBySlug, getRelatedPosts } from '@content/blogPosts'
import NotFoundPage from './NotFoundPage'
import { publisherSchema } from '@lib/structuredData'
import { socialImagePath } from '@lib/socialImages'
import { getArticleResource } from '@content/blogPosts'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPostBySlug(slug) : undefined

  if (!post) return <NotFoundPage />

  const related = getRelatedPosts(post)

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    ...(post.dateModified ? { dateModified: post.dateModified } : {}),
    author: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME },
    publisher: publisherSchema(),
    image: `${SITE_URL}${socialImagePath(`/blog/${post.slug}`)}`,
    inLanguage: 'en',
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
    articleSection: post.category,
  }
  const resource = getArticleResource(post)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title={post.title}
        description={post.excerpt}
        path={`/blog/${post.slug}`}
        type="article"
        jsonLd={[
          articleJsonLd,
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
              { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}/blog/${post.slug}` },
            ],
          },
        ]}
      />

      <main className="flex flex-1 flex-col">
      <article style={{ paddingTop: 56, paddingBottom: 72 }}>
        <div className="site-container" style={{ maxWidth: 760 }}>
          <Link
            to="/blog"
            className="inline-flex items-center text-gray-500 hover:text-navy-600 transition-colors"
            style={{ gap: 6, fontSize: 13.5, marginBottom: 28 }}
          >
            <ArrowLeft size={14} /> Back to blog
          </Link>

          <p
            className="font-semibold uppercase text-sky-700"
            style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 12 }}
          >
            {post.category}
          </p>
          <h1
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(1.9rem, 3.6vw, 2.6rem)', lineHeight: 1.15, letterSpacing: '-0.025em', marginBottom: 14 }}
          >
            {post.title}
          </h1>
          <p className="text-gray-500" style={{ fontSize: 13.5, marginBottom: 36 }}>
            By {SITE_NAME} · <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.dateModified && <> · Updated <time dateTime={post.dateModified}>{formatDate(post.dateModified)}</time></>}
            {' '}· {post.readMins} min read
          </p>

          {/* Reading column: 17px at 1.75 reads better than the 16px/1.6 this used,
              and the in-body headings get a size that separates them from the
              paragraphs instead of sitting 4px above them. */}
          <div style={{ display: 'grid', gap: 20 }}>
            {post.body.map((para, i) =>
              para.startsWith('## ') ? (
                <h2
                  key={i}
                  className="font-bold text-navy-600"
                  style={{ fontSize: 21, lineHeight: 1.3, marginTop: 16 }}
                >
                  {para.slice(3)}
                </h2>
              ) : (
                <p key={i} className="text-gray-600" style={{ fontSize: 17, lineHeight: 1.75 }}>{para}</p>
              )
            )}
          </div>

          {post.sources && (
            <section aria-label="References" style={{ marginTop: 28 }}>
              <h2 className="font-bold text-navy-600" style={{ fontSize: 21, marginBottom: 12 }}>References</h2>
              <ul className="list-disc pl-5 text-gray-600">
                {post.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} className="text-navy-600 underline underline-offset-2">{source.label}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <aside aria-label="Related tool" className="text-gray-600" style={{ marginTop: 28, fontSize: 16, lineHeight: 1.7 }}>
            {resource.description}{' '}
            <Link to={resource.path} className="text-navy-600 underline underline-offset-2">{resource.label}</Link>.
          </aside>

          {/* Inline CTA */}
          <div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-[14px] border border-gray-200 bg-[#FAFBFC]"
            style={{ marginTop: 44, padding: 24, gap: 18 }}
          >
            <div>
              <p className="font-semibold text-navy-600" style={{ fontSize: 16, marginBottom: 4 }}>
                Try Vidora free
              </p>
              <p className="text-gray-500" style={{ fontSize: 14 }}>
                Turn a topic into a published video — no credit card required.
              </p>
            </div>
            <Link to="/signup" className="btn-primary whitespace-nowrap">
              Start free <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="border-t border-gray-100 bg-[#FAFBFC]">
          <div className="site-container" style={{ paddingTop: 56, paddingBottom: 72 }}>
            <h2
              className="font-semibold uppercase text-gray-500"
              style={{ fontSize: 11, letterSpacing: '0.09em', marginBottom: 20 }}
            >
              Related guides
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 18 }}>
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/blog/${r.slug}`}
                  className="group rounded-[14px] border border-gray-200 bg-white hover:border-navy-600 transition-colors"
                  style={{ padding: 22 }}
                >
                  <h3
                    className="font-semibold text-navy-600 line-clamp-2 group-hover:text-navy-700"
                    style={{ fontSize: 16, lineHeight: 1.35, marginBottom: 8 }}
                  >
                    {r.title}
                  </h3>
                  <p className="text-gray-500 line-clamp-2" style={{ fontSize: 14, lineHeight: 1.6 }}>{r.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      </main>
      <Footer />
    </div>
  )
}
