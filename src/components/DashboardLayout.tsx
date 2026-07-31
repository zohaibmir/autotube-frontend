import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Lightbulb, ListOrdered, Briefcase, Tv, Settings, CreditCard,
  LogOut, ChevronLeft, Menu, BarChart2, Share2, CalendarDays, Film, Sparkles, ShieldCheck, MessageSquare, Clapperboard,
  AlertCircle, ArrowRight, X,
} from 'lucide-react'
import { useAuthStore } from '@store/auth'
import { useQuery } from '@tanstack/react-query'
import { billingApi } from '@api/services'

interface DashboardLayoutProps {
  children: React.ReactNode
}

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { path: '/app',           label: 'Dashboard', icon: LayoutDashboard, exact: true  },
    ],
  },
  {
    label: 'Create',
    items: [
      { path: '/app/create/ideas', label: 'New Video', icon: Lightbulb, exact: false, primary: true },
      { path: '/app/queue',        label: 'Queue',     icon: ListOrdered, exact: false },
      { path: '/app/shorts',       label: 'Shorts',    icon: Clapperboard, exact: false },
    ],
  },
  {
    label: 'Monitor',
    items: [
      { path: '/app/jobs',      label: 'Jobs',      icon: Briefcase,       exact: false },
      { path: '/app/channels',  label: 'Channels',  icon: Tv,              exact: false },
      { path: '/app/social',    label: 'Social',    icon: Share2,          exact: false },
      { path: '/app/community', label: 'Community', icon: MessageSquare,   exact: false },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { path: '/app/analytics', label: 'Analytics', icon: BarChart2,       exact: false },
      { path: '/app/admin',     label: 'Admin',      icon: ShieldCheck,     exact: false, adminOnly: true },
    ],
  },
  {
    label: 'Tools',
    items: [
      { path: '/app/studio',   label: 'Studio',     icon: Film,        exact: false },
      { path: '/app/kids',     label: 'Kids Studio', icon: Sparkles,    exact: false },
      { path: '/app/calendar', label: 'Calendar',    icon: CalendarDays, exact: false },
    ],
  },
]

const BOTTOM_NAV = [
  { path: '/app/settings', label: 'Settings', icon: Settings,     exact: false },
  { path: '/app/billing',  label: 'Billing',  icon: CreditCard,   exact: false },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const userEmail = user?.email ?? ''
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  // Reset banner when usage drops (e.g. plan upgrade)
  useEffect(() => { setBannerDismissed(false) }, [])

  const { data: usageData } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  })

  const handleSignOut = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path: string, exact: boolean) => {
    if (exact) return location.pathname === path || location.pathname === path + '/'
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const userInitial = userEmail ? userEmail[0].toUpperCase() : 'U'

  return (
    <div className="flex h-screen bg-[#FAFAFA]">
      {/* Skip to main content — visible only on keyboard focus */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`${sidebarOpen ? 'w-[220px]' : 'w-[52px]'} flex-shrink-0 bg-white border-r border-[#E5E5E5] flex flex-col transition-all duration-200 overflow-hidden`}
      >
        {/* Logo row */}
        <div className="h-14 flex items-center justify-between px-3 flex-shrink-0">
          {sidebarOpen && (
            <span className="text-[13px] font-semibold text-[#0A0A0A] tracking-tight truncate pl-1">
              YT Automation
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] rounded transition-colors flex-shrink-0"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <ChevronLeft size={15} strokeWidth={1.5} /> : <Menu size={15} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Main navigation">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-1">
              {sidebarOpen && (
                <p className="px-2 pt-3 pb-1.5 text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest select-none">
                  {section.label}
                </p>
              )}
              {!sidebarOpen && <div className="h-2" />}

              {section.items.map((item) => {
                if ('adminOnly' in item && item.adminOnly && !isAdmin) return null
                const Icon   = item.icon
                const active = isActive(item.path, item.exact)
                const isPrimary = 'primary' in item && item.primary

                if (isPrimary && !active) {
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={!sidebarOpen ? item.label : undefined}
                      className={`flex items-center gap-2.5 px-2 h-8 rounded mb-0.5 transition-colors
                        bg-[#0A0A0A] text-white hover:bg-[#262626]
                        ${!sidebarOpen ? 'justify-center' : ''}`}
                    >
                      <Icon size={14} strokeWidth={1.5} className="flex-shrink-0" />
                      {sidebarOpen && <span className="text-[13px] font-medium">{item.label}</span>}
                    </Link>
                  )
                }

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={!sidebarOpen ? item.label : undefined}
                    className={[
                      'flex items-center gap-2.5 px-2 h-8 rounded mb-0.5 transition-colors',
                      !sidebarOpen ? 'justify-center' : '',
                      active
                        ? 'border-l-2 border-[#0A0A0A] bg-[#F5F5F5] text-[#0A0A0A] font-semibold rounded-l-none'
                        : 'text-[#525252] hover:bg-[#F5F5F5] hover:text-[#0A0A0A]',
                    ].join(' ')}
                  >
                    <Icon
                      size={14}
                      strokeWidth={1.5}
                      className={`flex-shrink-0 ${active ? 'text-[#0A0A0A]' : 'text-[#A3A3A3]'}`}
                    />
                    {sidebarOpen && <span className="text-[13px]">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom nav: settings / billing */}
        <div className="px-2 py-2 border-t border-[#E5E5E5] flex-shrink-0">
          {BOTTOM_NAV.map((item) => {
            const Icon   = item.icon
            const active = isActive(item.path, item.exact)
            return (
              <Link
                key={item.path}
                to={item.path}
                title={!sidebarOpen ? item.label : undefined}
                className={[
                  'flex items-center gap-2.5 px-2 h-8 rounded mb-0.5 transition-colors',
                  !sidebarOpen ? 'justify-center' : '',
                  active
                    ? 'border-l-2 border-[#0A0A0A] bg-[#F5F5F5] text-[#0A0A0A] font-semibold rounded-l-none'
                    : 'text-[#525252] hover:bg-[#F5F5F5] hover:text-[#0A0A0A]',
                ].join(' ')}
              >
                <Icon
                  size={14}
                  strokeWidth={1.5}
                  className={`flex-shrink-0 ${active ? 'text-[#0A0A0A]' : 'text-[#A3A3A3]'}`}
                />
                {sidebarOpen && <span className="text-[13px]">{item.label}</span>}
              </Link>
            )
          })}
        </div>

        {/* User footer */}
        <div className="px-2 py-2 border-t border-[#E5E5E5] flex-shrink-0">
          {/* Usage mini-bar (sidebar expanded only) */}
          {sidebarOpen && usageData && usageData.plan !== 'enterprise' && usageData.plan !== 'unlimited' && (
            <div className="px-2 pb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[#A3A3A3] uppercase tracking-widest font-medium">
                  {usageData.plan === 'free' ? 'Free' : 'Pro'}
                </span>
                <span className={`text-[10px] font-medium ${usageData.pct >= 100 ? 'text-[#DC2626]' : usageData.pct >= 80 ? 'text-[#B45309]' : 'text-[#A3A3A3]'}`}>
                  {usageData.used}/{usageData.limit}
                </span>
              </div>
              <div className="h-1 bg-[#F5F5F5] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usageData.pct >= 100 ? 'bg-[#DC2626]' : usageData.pct >= 80 ? 'bg-[#F59E0B]' : 'bg-[#0A0A0A]'}`}
                  style={{ width: `${Math.min(usageData.pct, 100)}%` }}
                />
              </div>
              {usageData.plan === 'free' && usageData.pct >= 80 && (
                <Link
                  to="/app/billing"
                  className="flex items-center gap-0.5 mt-1.5 text-[10px] text-[#525252] hover:text-[#0A0A0A] transition-colors"
                >
                  Upgrade <ArrowRight size={9} strokeWidth={1.5} />
                </Link>
              )}
            </div>
          )}

          <div className={`flex items-center gap-2 px-2 mb-0.5 h-8 ${!sidebarOpen ? 'justify-center' : ''}`}>
            <div className="w-6 h-6 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {userInitial}
            </div>
            {sidebarOpen && (
              <p className="text-[12px] text-[#525252] truncate flex-1 min-w-0">
                {userEmail || 'User'}
              </p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className={`w-full flex items-center gap-2.5 px-2 h-8 rounded transition-colors text-[#A3A3A3] hover:text-[#DC2626] hover:bg-[#FEF2F2] ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <LogOut size={14} strokeWidth={1.5} className="flex-shrink-0" />
            {sidebarOpen && <span className="text-[13px]">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main id="main-content" className="flex-1 overflow-auto min-w-0" tabIndex={-1}>
        {/* Usage warning banner — shown at ≥80%, hidden if dismissed or on billing page */}
        {usageData && usageData.plan !== 'enterprise' && usageData.plan !== 'unlimited' && usageData.pct >= 80 && !bannerDismissed && location.pathname !== '/app/billing' && (
          <div className={`flex items-center justify-between gap-3 px-6 py-2.5 border-b text-[13px] ${
            usageData.pct >= 100
              ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
              : 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
          }`}>
            <div className="flex items-center gap-2">
              <AlertCircle size={14} strokeWidth={1.5} className="flex-shrink-0" />
              {usageData.pct >= 100
                ? <span>You've used all <strong>{usageData.limit}</strong> free videos this month. <Link to="/app/billing" className="underline font-medium hover:opacity-80">Upgrade to Pro</Link> to continue generating.</span>
                : <span>You're at <strong>{usageData.pct}%</strong> of your monthly limit ({usageData.used}/{usageData.limit} videos). <Link to="/app/billing" className="underline font-medium hover:opacity-80">Upgrade for more headroom →</Link></span>
              }
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="flex-shrink-0 hover:opacity-60 transition-opacity"
              aria-label="Dismiss"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
