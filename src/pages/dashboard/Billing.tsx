import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ArrowRight,
  CreditCard,
  AlertCircle,
  Zap,
  Building2,
  Rocket,
  Loader2,
  ExternalLink,
  PartyPopper,
  X,
} from 'lucide-react'
import { billingApi } from '@api/services'
import { SALES_EMAIL } from '@lib/site'
import { apiErrorMessage } from '@lib/apiError'
import { ANIMATED_EPISODE, PLAN_CREDITS, channelLimit, channelPhrase, perMonth } from '@lib/creditCosts'

// ── Plan definitions ──────────────────────────────────────────────────────────

// Must match core/pricing.PLAN_PRICE_USD and core/metering.PLAN_CREDITS (§5.3).
// Claims are limited to SHIPPED capability -- 4K, voice cloning, fine-tuning and
// a public API are not built yet and are not advertised here.
//
// The credit figures come from @lib/creditCosts rather than being typed here
// twice; `scripts/test_marketing_credit_costs.py` checks them against the backend.
const _fmt = (n: number | null) => (n == null ? 'Unlimited' : n.toLocaleString('en-US'))

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    credits: `${PLAN_CREDITS.free} one-time`,
    channels: channelLimit('free'),
    features: [`${PLAN_CREDITS.free} credits (one-time)`, channelPhrase('free'), 'AI scripts + SEO', 'Standard voiceovers', 'Auto upload to YouTube'],
    icon: Rocket,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 19,
    credits: `${_fmt(PLAN_CREDITS.starter)} / month`,
    channels: channelLimit('starter'),
    features: [`${_fmt(PLAN_CREDITS.starter)} credits / month`, channelPhrase('starter'), 'Premium AI voice (ElevenLabs)', 'Vertical Shorts', 'Credits roll over 1 month'],
    icon: Rocket,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    credits: `${_fmt(PLAN_CREDITS.pro)} / month`,
    channels: channelLimit('pro'),
    features: [`${_fmt(PLAN_CREDITS.pro)} credits / month`, channelPhrase('pro'), 'Animated kids episodes', 'Scheduler, queue & calendar', 'Analytics + auto-post Reels to IG, FB & TikTok'],
    icon: Zap,
    recommended: true,
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 99,
    credits: `${_fmt(PLAN_CREDITS.studio)} / month`,
    channels: channelLimit('studio'),
    features: [`${_fmt(PLAN_CREDITS.studio)} credits / month`, channelPhrase('studio'), `~${perMonth('studio', ANIMATED_EPISODE.defaultCredits)} animated episodes`, 'Custom Studio (own clips)', 'Character profiles'],
    icon: Zap,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: null,
    credits: `${_fmt(PLAN_CREDITS.agency)} / month`,
    channels: channelLimit('agency'),
    features: [`${_fmt(PLAN_CREDITS.agency)} credits / month`, channelPhrase('agency'), 'Onboarding', 'Priority support'],
    icon: Building2,
  },
] as const

// ── Usage bar ─────────────────────────────────────────────────────────────────

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number | typeof Infinity
}) {
  const isUnlimited = limit === Infinity || limit >= 9999
  const pct = isUnlimited ? 0 : Math.round((used / limit) * 100)
  const over80 = pct > 80

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-[#525252]">{label}</span>
        <span className="text-sm font-medium text-[#0A0A0A]">
          {used} / {isUnlimited ? '∞' : limit}
        </span>
      </div>
      <div className="h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over80 ? 'bg-[#F59E0B]' : 'bg-[#0A0A0A]'}`}
          style={{ width: isUnlimited ? '0%' : `${Math.min(pct, 100)}%` }}
        />
      </div>
      {over80 && (
        <p className="text-xs text-[#B45309] mt-1.5 flex items-center gap-1">
          <AlertCircle size={11} strokeWidth={1.5} />
          {pct}% used - consider upgrading for more headroom
        </p>
      )}
    </div>
  )
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isCurrent,
  isLoading,
  onUpgrade,
}: {
  plan: (typeof PLANS)[number]
  isCurrent: boolean
  isLoading: boolean
  onUpgrade: () => void
}) {
  const Icon = plan.icon
  return (
    <div
      className={`bg-white rounded-md border p-5 ${'recommended' in plan && plan.recommended
        ? 'border-[#0A0A0A]'
        : isCurrent
        ? 'border-[#A3A3A3]'
        : 'border-[#E5E5E5]'
      }`}
    >
      {'recommended' in plan && plan.recommended && (
        <span className="inline-block text-[10px] font-bold tracking-widest uppercase bg-[#0A0A0A] text-white px-2.5 py-0.5 rounded-full mb-3">
          Recommended
        </span>
      )}
      {isCurrent && !('recommended' in plan && plan.recommended) && (
        <span className="inline-block text-[10px] font-bold tracking-widest uppercase bg-[#F5F5F5] text-[#525252] px-2.5 py-0.5 rounded-full mb-3 border border-[#E5E5E5]">
          Current plan
        </span>
      )}

      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} strokeWidth={1.5} className="text-[#525252]" />
        <p className="font-semibold text-[#0A0A0A]">{plan.name}</p>
      </div>

      <p className="text-2xl font-semibold text-[#0A0A0A] mt-2 mb-4">
        {plan.price === null ? (
          'Custom'
        ) : plan.price === 0 ? (
          'Free'
        ) : (
          <>
            ${plan.price}
            <span className="text-sm font-normal text-[#A3A3A3]">/mo</span>
          </>
        )}
      </p>

      <ul className="space-y-1.5 mb-5">
        {plan.features.map((f, idx) => (
          <li key={`${plan.id}-feat-${idx}`} className="flex items-center gap-2 text-xs text-[#525252]">
            <CheckCircle2 size={11} strokeWidth={2} className="text-[#0A0A0A] flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className="w-full py-2 rounded-md border border-[#E5E5E5] text-center text-xs text-[#A3A3A3] font-medium">
          Active
        </div>
      ) : plan.price === null ? (
        <a
          href={`mailto:${SALES_EMAIL}?subject=Enterprise plan enquiry`}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md border border-[#0A0A0A] text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
        >
          Contact Sales <ArrowRight size={12} strokeWidth={1.5} />
        </a>
      ) : (
        <button
          onClick={onUpgrade}
          disabled={isLoading}
          className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${'recommended' in plan && plan.recommended
            ? 'bg-[#0A0A0A] text-white hover:bg-[#262626]'
            : 'border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#F5F5F5]'
          }`}
        >
          {isLoading
            ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
            : <>
                Upgrade to {plan.name} <ArrowRight size={12} strokeWidth={1.5} />
              </>
          }
        </button>
      )}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-[#F5F5F5] rounded animate-pulse ${className}`} />
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Billing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [loadingTopup, setLoadingTopup] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Parse Stripe redirect query params
  const params = new URLSearchParams(window.location.search)
  const stripeSuccess = params.get('success') === '1'
  const stripeCanceled = params.get('canceled') === '1'
  const upgradedPlan = params.get('plan')
  // One-off top-up return: /app/billing?topup=1&credits=300
  const topupSuccess = params.get('topup') === '1'
  const topupCredits = params.get('credits')

  const { data: me, isLoading } = useQuery({
    queryKey: ['billing-me'],
    queryFn: () => billingApi.getMe(),
    staleTime: 30_000,
  })

  const planId: string = me?.plan ?? 'free'
  // `videos_used_this_month` / `videos_limit` are gone: credits are the
  // currency, and nothing increments or reads the video counter any more.
  const channels: any[] = me?.channels ?? []
  const isPaidPlan = planId !== 'free'

  // W8/W9: credits are the real currency, so the page leads with them.
  const { data: creditsUsage } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    staleTime: 30_000,
  })
  const creditsRemaining = creditsUsage?.credits_remaining ?? null
  const planCredits = creditsUsage?.plan_credits ?? null
  const creditsTopup = creditsUsage?.credits_topup ?? 0
  const creditsUsed = (creditsRemaining != null && planCredits != null)
    ? Math.max(0, planCredits - creditsRemaining)
    : null

  // Top-up packages. Empty is a normal state (no Stripe price IDs configured);
  // `stripe_configured` tells us whether to explain why.
  const { data: topupData } = useQuery({
    queryKey: ['billing-packages'],
    queryFn: () => billingApi.packages(),
    staleTime: 5 * 60_000,
  })
  const topupPackages = topupData?.packages ?? []

  const currentPlan = PLANS.find((p) => p.id === planId) ?? PLANS[0]

  async function handleUpgrade(targetPlanId: string) {
    if (targetPlanId === 'agency') {
      window.location.href = `mailto:${SALES_EMAIL}?subject=Agency plan enquiry`
      return
    }
    setLoadingPlan(targetPlanId)
    setErrorMsg(null)
    try {
      const { checkout_url } = await billingApi.checkout(targetPlanId)
      window.location.href = checkout_url
    } catch (err: any) {
      setErrorMsg(apiErrorMessage(err, 'Could not start checkout. Try again.'))
      setLoadingPlan(null)
    }
  }

  async function handleTopup(packageId: string) {
    setLoadingTopup(packageId)
    setErrorMsg(null)
    try {
      const { checkout_url } = await billingApi.topup(packageId)
      window.location.href = checkout_url
    } catch (err: any) {
      setErrorMsg(apiErrorMessage(err, 'Could not start top-up checkout. Try again.'))
      setLoadingTopup(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    setErrorMsg(null)
    try {
      const { portal_url } = await billingApi.portal()
      window.location.href = portal_url
    } catch (err: any) {
      setErrorMsg(apiErrorMessage(err, 'Could not open billing portal. Try again.'))
      setPortalLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#0A0A0A]">Billing</h1>
            <p className="text-sm text-[#A3A3A3] mt-0.5">Manage your plan, usage, and payment details</p>
          </div>
          {isPaidPlan && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#E5E5E5] text-[13px] text-[#525252] hover:border-[#D4D4D4] hover:text-[#0A0A0A] transition-colors disabled:opacity-40"
            >
              {portalLoading
                ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                : <ExternalLink size={13} strokeWidth={1.5} />}
              Manage Billing
            </button>
          )}
        </div>

        {/* Stripe redirect banners */}
        {stripeSuccess && (
          <div className="mt-4 flex items-center gap-2.5 px-4 py-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-md">
            <PartyPopper size={15} strokeWidth={1.5} className="text-[#16A34A] flex-shrink-0" />
            <p className="text-[13px] text-[#15803D] font-medium">
              You're now on the {upgradedPlan ? upgradedPlan.charAt(0).toUpperCase() + upgradedPlan.slice(1) : 'new'} plan - thank you!
            </p>
          </div>
        )}
        {stripeCanceled && (
          <div className="mt-4 flex items-center gap-2.5 px-4 py-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-md">
            <AlertCircle size={15} strokeWidth={1.5} className="text-[#C2410C] flex-shrink-0" />
            <p className="text-[13px] text-[#C2410C]">Checkout was canceled - your plan has not changed.</p>
          </div>
        )}
        {topupSuccess && (
          <div className="mt-4 flex items-center gap-2.5 px-4 py-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-md">
            <CheckCircle2 size={15} strokeWidth={1.5} className="text-[#16A34A] flex-shrink-0" />
            <p className="text-[13px] text-[#15803D] font-medium">
              Top-up complete{topupCredits ? ` - ${topupCredits} credits added` : ''}. They're in your balance now and never expire.
            </p>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 flex items-center justify-between gap-2.5 px-4 py-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} strokeWidth={1.5} className="text-[#DC2626] flex-shrink-0" />
              <p className="text-[13px] text-[#DC2626]">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-[#DC2626] hover:opacity-70">
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      <div className="px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT: Current plan + Usage + Keys + Invoices ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Current plan card */}
            <div className="bg-white border border-[#E5E5E5] rounded-md p-6">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-32" />
                  <div className="flex flex-wrap gap-2 mt-4">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-28 rounded-full" />)}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase mb-1">
                        Current Plan
                      </p>
                      <h2 className="text-2xl font-semibold text-[#0A0A0A]">{currentPlan.name}</h2>
                      <p className="text-[12px] font-medium text-[#0369A1] mt-1">
                        {currentPlan.credits} credits
                      </p>
                    </div>
                    <span className="text-2xl font-semibold text-[#0A0A0A]">
                      {currentPlan.price === 0
                        ? 'Free'
                        : currentPlan.price === null
                        ? 'Custom'
                        : `$${currentPlan.price}/mo`}
                    </span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {currentPlan.features.map((f, idx) => (
                      <span
                        key={`current-feat-${idx}`}
                        className="inline-flex items-center gap-1.5 text-xs text-[#525252] bg-[#F5F5F5] px-2.5 py-1 rounded-full"
                      >
                        <CheckCircle2 size={10} strokeWidth={2} className="text-[#0A0A0A]" />
                        {f}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Usage meters */}
            <div className="bg-white border border-[#E5E5E5] rounded-md p-6">
              <p className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase mb-5">
                This Month's Usage
              </p>
              {isLoading ? (
                <div className="space-y-5">
                  {[1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-1.5 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Credits first: they are what actually gates rendering. The
                      older "Videos generated" bar was driven by
                      videos_used_this_month, which nothing increments any more,
                      so it always read 0. */}
                  {creditsRemaining != null ? (
                    <UsageBar
                      label={`Credits used (${planCredits ?? 0}/period)`}
                      used={creditsUsed ?? 0}
                      limit={planCredits ?? 0}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#525252]">Credits</span>
                      <span className="text-sm font-medium text-[#0A0A0A]">Unlimited</span>
                    </div>
                  )}
                  {creditsTopup > 0 && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#525252]">Purchased credits</span>
                      <span className="font-medium text-[#0A0A0A]">
                        {creditsTopup.toLocaleString()}{' '}
                        <span className="text-[#A3A3A3] font-normal">(never expire)</span>
                      </span>
                    </div>
                  )}
                  <UsageBar
                    label="Channels connected"
                    used={channels.length}
                    limit={
                      creditsUsage?.channels_limit != null
                        ? creditsUsage.channels_limit
                        : (currentPlan.channels === Infinity ? Infinity : currentPlan.channels)
                    }
                  />
                </div>
              )}
            </div>

            {/* Credit top-ups */}
            <div className="bg-white border border-[#E5E5E5] rounded-md p-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">
                  Buy credits
                </p>
                {creditsTopup > 0 && (
                  <span className="text-[11px] text-[#A3A3A3]">
                    {creditsTopup.toLocaleString()} purchased
                  </span>
                )}
              </div>
              <p className="text-xs text-[#A3A3A3] mb-4">
                One-off credit packs. They never expire, and they are only spent once your
                monthly allowance runs out - so a renewal can never wipe credits you paid for.
              </p>
              {topupPackages.length === 0 ? (
                <p className="text-[13px] text-[#A3A3A3]">
                  {topupData && !topupData.stripe_configured
                    ? 'Credit top-ups are not available yet on this deployment.'
                    : 'No credit packs are available right now.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {topupPackages.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => handleTopup(pkg.id)}
                      disabled={loadingTopup !== null}
                      className="text-left p-4 rounded-md border border-[#E5E5E5] hover:border-[#0A0A0A] transition-colors disabled:opacity-40"
                    >
                      <p className="text-sm font-semibold text-[#0A0A0A]">
                        {pkg.credits.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-[#A3A3A3] mb-2">credits</p>
                      <p className="text-[13px] text-[#525252] flex items-center gap-1.5">
                        {loadingTopup === pkg.id
                          ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                          : <Zap size={12} strokeWidth={1.5} />}
                        ${pkg.price_usd.toFixed(2)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* BYOK key status summary */}
            {!isLoading && me?.api_keys_set && (
              <div className="bg-white border border-[#E5E5E5] rounded-md p-6">
                <p className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase mb-4">
                  API Keys (BYOK)
                </p>
                <div className="grid grid-cols-2 gap-x-6">
                  {Object.entries(me.api_keys_set as Record<string, boolean>).map(([service, isSet]) => (
                    <div
                      key={service}
                      className="flex items-center justify-between py-2.5 border-b border-[#F5F5F5] last:border-0"
                    >
                      <span className="text-sm capitalize text-[#0A0A0A]">{service}</span>
                      <span className={`text-[11px] font-medium ${isSet ? 'text-[#16A34A]' : 'text-[#A3A3A3]'}`}>
                        {isSet ? '● Active' : '○ Not set'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#A3A3A3] mt-3">
                  Manage keys in{' '}
                  <a href="/app/settings" className="underline hover:text-[#0A0A0A] transition-colors">
                    Settings → API Keys
                  </a>
                </p>
              </div>
            )}

            {/* Invoices */}
            <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
                <p className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">
                  Billing History
                </p>
                {isPaidPlan && (
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="flex items-center gap-1 text-[11px] text-[#525252] hover:text-[#0A0A0A] transition-colors disabled:opacity-40"
                  >
                    View all invoices <ExternalLink size={11} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              <div className="px-6 py-10 text-center text-sm text-[#A3A3A3]">
                <CreditCard size={20} strokeWidth={1.5} className="mx-auto mb-3 text-[#D4D4D4]" />
                {isPaidPlan
                  ? 'Invoice history is available in the Stripe billing portal.'
                  : 'No invoices yet. Invoices appear here after upgrading to a paid plan.'}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Plan cards ── */}
          <div className="space-y-4">
            <p className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">Plans</p>
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={plan.id === planId}
                isLoading={loadingPlan === plan.id}
                onUpgrade={() => handleUpgrade(plan.id)}
              />
            ))}

            {/* Payment / manage billing */}
            <div className="bg-white border border-[#E5E5E5] rounded-md p-5">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={14} strokeWidth={1.5} className="text-[#A3A3A3]" />
                <span className="text-xs font-medium text-[#0A0A0A]">Payment &amp; Invoices</span>
              </div>
              {isPaidPlan ? (
                <>
                  <p className="text-xs text-[#525252] mb-3">
                    View invoices, update your card, or cancel your subscription via the Stripe portal.
                  </p>
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md bg-[#0A0A0A] text-white text-xs font-medium hover:bg-[#262626] transition-colors disabled:opacity-40"
                  >
                    {portalLoading
                      ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                      : <ExternalLink size={12} strokeWidth={1.5} />}
                    Open Billing Portal
                  </button>
                </>
              ) : (
                <p className="text-xs text-[#A3A3A3]">
                  No card on file. Subscribe to a paid plan above to add payment details.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

