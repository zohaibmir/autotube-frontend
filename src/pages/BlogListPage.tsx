import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { ArrowRight } from 'lucide-react'
import { BLOG_POSTS, CATEGORIES, type BlogCategory } from '@content/blogPosts'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BlogListPage() {
  const [activeCategory, setActiveCategory] = useState<BlogCategory | 'All'>('All')

  const posts = useMemo(() => {
    const sorted = [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1))
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
          name: 'Channelpilot Blog',
          description: 'Notes on AI content creation, YouTube growth and SEO, the creator economy, and production automation.',
        }}
      />

      {/* Hero */}
      <section className="pt-28 pb-16 px-6 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-sky-500 font-semibold text-sm uppercase tracking-widest mb-5">Blog</p>
          <h1 className="text-5xl font-bold text-navy-600 leading-[1.1] mb-5">
            Notes on AI content, YouTube growth, and building a real production system.
          </h1>
          <p className="text-xl text-gray-500 max-w-xl">
            {BLOG_POSTS.length} posts on production, SEO, the creator economy, and automation - written honestly, no growth-hack fluff.
          </p>
        </div>
      </section>

      {/* Category filter */}
      <section className="py-8 px-6 border-b border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-2">
          {(['All', ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-navy-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-navy-600 hover:text-navy-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Post grid */}
      <section className="py-16 px-6 flex-1">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="group border border-gray-200 rounded-xl p-6 hover:border-navy-600 hover:shadow-sm transition-all flex flex-col"
            >
              <p className="text-xs font-bold text-sky-500 uppercase tracking-widest mb-3">{post.category}</p>
              <h2 className="text-lg font-semibold text-navy-600 leading-snug mb-2 line-clamp-2 group-hover:text-navy-700">
                {post.title}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-5 line-clamp-3 flex-1">{post.excerpt}</p>
              <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-gray-100">
                <span>{formatDate(post.date)} · {post.readMins} min read</span>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-navy-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          ))}
        </div>
        {posts.length === 0 && (
          <p className="text-center text-gray-400 py-16">No posts in this category yet.</p>
        )}
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-gray-50 border-t border-gray-100">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-navy-600 mb-1">Ready to put this into practice?</h2>
            <p className="text-gray-500 text-sm">Start producing videos with Channelpilot - free, no credit card required.</p>
          </div>
          <Link to="/signup" className="btn-primary whitespace-nowrap">Start free</Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
