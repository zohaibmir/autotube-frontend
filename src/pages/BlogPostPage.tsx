import { Link, Navigate, useParams } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO, { SITE_NAME, SITE_URL } from '@components/SEO'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getPostBySlug, getRelatedPosts } from '@content/blogPosts'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPostBySlug(slug) : undefined

  if (!post) return <Navigate to="/blog" replace />

  const related = getRelatedPosts(post)

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
    articleSection: post.category,
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title={post.title}
        description={post.excerpt}
        path={`/blog/${post.slug}`}
        jsonLd={articleJsonLd}
      />

      <article className="pt-28 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy-600 mb-8">
            <ArrowLeft size={14} /> Back to Blog
          </Link>

          <p className="text-sky-500 font-semibold text-sm uppercase tracking-widest mb-4">{post.category}</p>
          <h1 className="text-4xl font-bold text-navy-600 leading-[1.15] mb-4">{post.title}</h1>
          <p className="text-sm text-gray-400 mb-10">
            {formatDate(post.date)} · {post.readMins} min read
          </p>

          <div className="space-y-5">
            {post.body.map((para, i) =>
              para.startsWith('## ') ? (
                <h2 key={i} className="text-xl font-bold text-navy-600 pt-4">{para.slice(3)}</h2>
              ) : (
                <p key={i} className="text-gray-600 leading-relaxed">{para}</p>
              )
            )}
          </div>

          {/* Inline CTA */}
          <div className="mt-14 p-8 rounded-xl bg-gray-50 border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="font-semibold text-navy-600 mb-1">Try Channelpilot free</p>
              <p className="text-sm text-gray-500">Turn a topic into a published video - no credit card required.</p>
            </div>
            <Link to="/signup" className="btn-primary whitespace-nowrap">Start free <ArrowRight size={16} /></Link>
          </div>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="py-16 px-6 bg-gray-50 border-t border-gray-100">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">More on {post.category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/blog/${r.slug}`}
                  className="group bg-white border border-gray-200 rounded-xl p-6 hover:border-navy-600 hover:shadow-sm transition-all"
                >
                  <h3 className="text-base font-semibold text-navy-600 leading-snug mb-2 line-clamp-2 group-hover:text-navy-700">{r.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{r.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  )
}
