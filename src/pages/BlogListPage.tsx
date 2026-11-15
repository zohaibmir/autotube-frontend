import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { ArrowRight } from 'lucide-react'
import { BLOG_POSTS, CATEGORIES, type BlogCategory } from '@content/blogPosts'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default function BlogListPage() {
  const [activeCategory, setActiveCategory] = useState<BlogCategory | 'All'>('All')

  const posts = useMemo(() => {
    const sorted = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date))
    return activeCategory === 'All' ? sorted : sorted.filter((p) => p.category === activeCategory)
  }, [activeCategory])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Blog"
        description="Notes on AI content creation, YouTube growth and SEO, the creator economy, and production automation - written honestly, no growth-hack fluff."
        path="/blog"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'Vidora Blog',
          description: 'Notes on AI content creation, YouTube growth and SEO, the creator economy, and production automation.',
        }}
      />

      {/* Hero */}
      <main className="flex flex-1 flex-col">
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 48 }}>
          <p className="font-semibold uppercase text-sky-700" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}>
            Blog
          </p>
          <h1
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(2rem, 4vw, 2.9rem)', lineHeight: 1.1, letterSpacing: '-0.028em', maxWidth: 820 }}
          >
            Notes on AI content, YouTube growth, and building a real production system.
          </h1>
          <p className="text-gray-500" style={{ fontSize: 17, lineHeight: 1.7, marginTop: 18, maxWidth: 620 }}>
            {BLOG_POSTS.length} posts on production, SEO, the creator economy, and automation —
            written honestly, no growth-hack fluff.
          </p>
        </div>
      </section>

      {/* Category filter */}
      <section className="border-b border-gray-100 bg-[#FAFBFC]">
        <div
          className="site-container flex flex-wrap items-center"
          style={{ paddingTop: 20, paddingBottom: 20, gap: 8 }}
        >
          {(['All', ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-navy-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-navy-600 hover:text-navy-600'
              }`}
              style={{ padding: '7px 15px', fontSize: 13.5 }}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Post grid */}
      <section className="flex-1 border-b border-gray-100">
        <div
          className="site-container grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{ paddingTop: 56, paddingBottom: 72, gap: 18 }}
        >
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="group flex flex-col rounded-[14px] border border-gray-200 bg-white hover:border-navy-600 transition-colors"
              style={{ padding: 22 }}
            >
              <p
                className="font-semibold uppercase text-sky-700"
                style={{ fontSize: 10.5, letterSpacing: '0.09em', marginBottom: 10 }}
              >
                {post.category}
              </p>
              <h2
                className="font-semibold text-navy-600 line-clamp-2 group-hover:text-navy-700"
                style={{ fontSize: 17, lineHeight: 1.35, marginBottom: 8 }}
              >
                {post.title}
              </h2>
              <p
                className="text-gray-500 line-clamp-3 flex-1"
                style={{ fontSize: 14, lineHeight: 1.65, marginBottom: 18 }}
              >
                {post.excerpt}
              </p>
              <div
                className="flex items-center justify-between text-gray-500 border-t border-gray-100"
                style={{ paddingTop: 14, fontSize: 12 }}
              >
                <span>{formatDate(post.date)} · {post.readMins} min read</span>
                <ArrowRight
                  size={14}
                  className="text-gray-500 group-hover:text-navy-600 group-hover:translate-x-0.5 transition-all"
                />
              </div>
            </Link>
          ))}
        </div>
        {posts.length === 0 && (
          <p className="site-container text-center text-gray-500" style={{ paddingTop: 56, paddingBottom: 56 }}>
            No posts in this category yet.
          </p>
        )}
      </section>

      {/* CTA */}
      <section className="bg-navy-600">
        <div className="site-container text-center" style={{ paddingTop: 68, paddingBottom: 68 }}>
          <h2
            className="font-bold text-white"
            style={{ fontSize: 'clamp(1.6rem, 2.8vw, 2.05rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}
          >
            Ready to put this into practice?
          </h2>
          <p className="text-sky-200" style={{ fontSize: 16.5, lineHeight: 1.6, marginTop: 12 }}>
            Start producing videos with Vidora — free, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row justify-center" style={{ marginTop: 24 }}>
            <Link to="/signup" className="btn-primary btn-lg btn-inverse">
              Start free <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  )
}
