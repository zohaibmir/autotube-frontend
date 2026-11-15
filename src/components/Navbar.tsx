import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from '@components/Logo'

const NAV_LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/tools/seo-analyzer', label: 'SEO Analyzer' },
  { to: '/extension', label: 'Extension' },
  { to: '/blog', label: 'Blog' },
  { to: '/faq', label: 'FAQ' },
  { to: '/about', label: 'About' },
]

/**
 * Site header for the static/marketing pages.
 *
 * Metrics are explicit (inline height, arbitrary-value spacing) rather than
 * `h-16` / `gap-3`-style utilities, because tailwind.config.js doubles spacing
 * keys 0-16: `h-16` emitted 128px and the logo tile `w-7` emitted 56px, which is
 * most of why this header read as oversized and unfinished.
 */
export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()

  // Close the panel on navigation. Link clicks already do it, but browser
  // back/forward would otherwise leave it hanging open.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMobileOpen(false)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [mobileOpen])

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/85 backdrop-blur-md">
      <div className="site-container">
        <div className="flex items-center justify-between" style={{ height: 64 }}>
          {/* Brand */}
          <Link to="/" aria-label="Vidora home" className="flex-shrink-0">
            <Logo />
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden lg:flex items-center" style={{ gap: 2 }} aria-label="Main">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="site-nav-link"
                aria-current={pathname === link.to ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center" style={{ gap: 12 }}>
            <Link to="/login" className="site-nav-link">
              Sign in
            </Link>
            <Link to="/signup" className="btn-primary btn-primary-sm">
              Start free
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            ref={toggleRef}
            type="button"
            className="lg:hidden inline-flex items-center justify-center rounded-[8px] text-navy-600 hover:bg-gray-100 transition-colors"
            style={{ width: 40, height: 40 }}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls={mobileOpen ? 'mobile-navigation' : undefined}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div id="mobile-navigation" className="lg:hidden border-t border-gray-100 bg-white">
          <div className="site-container" style={{ paddingTop: 8, paddingBottom: 24 }}>
            <nav className="flex flex-col" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-[15px] font-medium text-gray-700 hover:text-navy-600 border-b border-gray-100 last:border-0 transition-colors"
                  style={{ paddingTop: 14, paddingBottom: 14 }}
                  aria-current={pathname === link.to ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col" style={{ gap: 10, marginTop: 20 }}>
              <Link to="/signup" className="btn-primary w-full">
                Start free
              </Link>
              <Link to="/login" className="btn-secondary w-full">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

