import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { ArrowRight, Check, Minus } from 'lucide-react'
import { SUPPORT_EMAIL } from '@lib/site'
import {
  ANIMATED_EPISODE,
  FREE_REFILL,
  OWN_KEYS_RENDER_CAP,
  PLAN_CREDITS,
  PLAN_PRICE_ANNUAL_USD,
  PLAN_PRICE_USD,
  UNIT_CREDITS,
  channelCount,
  channelPhrase,
  perMonth,
} from '@lib/creditCosts'

// Packages from docs/PACKAGING_AND_ANIMATION_STUDIO_PLAN.md §5.3. Prices must
// match core/pricing.PLAN_PRICE_USD and core/metering.PLAN_CREDITS -- those are
// what the products (and the server-side gate) actually use.
//
// Every claim here is a SHIPPED capability. Deliberately absent, because they are
// not built yet: 4K output, voice cloning, custom model fine-tuning, priority
// processing, and public API access for integrators. Advertising those pre-launch
// is a refund/chargeback vector.
// 2200 -> "2,200". `null` (unmetered) renders as "Unlimited".
const _fmt = (n: number | null) => (n == null ? 'Unlimited' : n.toLocaleString('en-US'))

type Plan = {
  id: string
  name: string
  creditsLine: string
  description: string
  cta: string
  ctaTo: string
  highlight: boolean
  badge?: string
  features: string[]
  limits?: string[]
}

const plans: Plan[] = [
  {
    id: 'free', name: 'Free',
    creditsLine: `${PLAN_CREDITS.free} credits to start, +${FREE_REFILL.monthly} / month`,
    description: 'Make your first videos free. No card required.',
    cta: 'Start free', ctaTo: '/signup', highlight: false,
    features: [
      `${PLAN_CREDITS.free} credits to start, +${FREE_REFILL.monthly} every month (up to ${FREE_REFILL.cap})`,
      channelPhrase('free', 'YouTube channel'),
      'AI scripts, titles, descriptions & tags',
      'Standard voiceovers (no key needed)',
      'Stock footage, auto upload to YouTube',
    ],
    limits: ['No animated episodes', 'No own API keys'],
  },
  {
    id: 'own_keys', name: 'Own Keys',
    creditsLine: `${OWN_KEYS_RENDER_CAP} renders / month on your keys`,
    description: 'Bring your AI. We run the factory.',
    cta: 'Start Own Keys', ctaTo: '/signup', highlight: false,
    features: [
      'Your own Claude, OpenAI or Gemini key writes the scripts',
      `${OWN_KEYS_RENDER_CAP} renders / month`,
      channelPhrase('own_keys', 'YouTube channel'),
      'Animated episodes on your own Kling or MiniMax key',
      'Scheduler, analytics & social auto-post',
      'No platform fee on your own keys',
      'Top up credits to use our keys for a single job',
    ],
  },
  {
    id: 'starter', name: 'Starter',
    creditsLine: `${_fmt(PLAN_CREDITS.starter)} credits / month`,
    description: 'For creators publishing regularly.',
    cta: 'Start Starter', ctaTo: '/signup', highlight: false,
    features: [
      `${_fmt(PLAN_CREDITS.starter)} credits / month`,
      channelPhrase('starter', 'YouTube channel'),
      'Everything in Free',
      'Premium AI voiceovers (ElevenLabs)',
      'Animated episodes (credit-limited)',
      'Vertical Shorts from one script',
      'Unused credits roll over one month',
    ],
  },
  {
    id: 'pro', name: 'Pro',
    creditsLine: `${_fmt(PLAN_CREDITS.pro)} credits / month`, badge: 'Most popular',
    description: 'For creators scaling across channels.',
    cta: 'Start Pro', ctaTo: '/signup', highlight: true,
    features: [
      `${_fmt(PLAN_CREDITS.pro)} credits / month`,
      channelPhrase('pro', 'YouTube channel'),
      'Everything in Starter',
      `~${perMonth('pro', ANIMATED_EPISODE.defaultCredits)} animated episodes / month`,
      'No platform fee on your own keys',
      'Scheduler, queue & content calendar',
      'Analytics + auto-post to IG, FB, TikTok, Telegram & Reddit',
      'Email support',
    ],
  },
  {
    id: 'studio', name: 'Studio',
    creditsLine: `${_fmt(PLAN_CREDITS.studio)} credits / month`,
    description: 'For animation-led channels.',
    cta: 'Start Studio', ctaTo: '/signup', highlight: false,
    features: [
      `${_fmt(PLAN_CREDITS.studio)} credits / month`,
      channelPhrase('studio', 'YouTube channel'),
      'Everything in Pro',
      `~${perMonth('studio', ANIMATED_EPISODE.defaultCredits)} animated episodes / month`,
      'Custom Studio (use your own clips)',
      'Character profiles for series consistency',
    ],
  },
  {
    id: 'agency', name: 'Agency',
    creditsLine: `${_fmt(PLAN_CREDITS.agency)} credits / month`,
    description: 'For agencies running multiple brands.',
    cta: 'Contact sales', ctaTo: '/contact', highlight: false,
    features: [
      `${_fmt(PLAN_CREDITS.agency)} credits / month`,
      channelPhrase('agency'),
      'Everything in Studio',
      'Onboarding + priority support',
    ],
  },
]

// $96 -> "96", $82.5 -> "82.50": whole dollars stay whole, cents always show two digits.
const _usd = (n: number) =>
  n.toLocaleString('en-US', Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// What the server enforces per plan (PRICING_STRATEGY.md §5.3, core/pricing.PLAN_FEATURES).
// Credits are still the main currency; these rows are the few things credits cannot express.
type EntRow = { feature: string } & Record<string, string | boolean>
const entitlements: EntRow[] = [
  {
    feature: 'Hosted credits / month',
    free: `+${FREE_REFILL.monthly} (${PLAN_CREDITS.free} to start)`,
    own_keys: 'Top-ups only',
    starter: _fmt(PLAN_CREDITS.starter),
    pro: _fmt(PLAN_CREDITS.pro),
    studio: _fmt(PLAN_CREDITS.studio),
    agency: _fmt(PLAN_CREDITS.agency),
  },
  { feature: 'YouTube channels', free: channelCount('free'), own_keys: channelCount('own_keys'), starter: channelCount('starter'), pro: channelCount('pro'), studio: channelCount('studio'), agency: channelCount('agency') },
  { feature: 'Renders / month', free: 'Credit-bound', own_keys: String(OWN_KEYS_RENDER_CAP), starter: 'Credit-bound', pro: 'Credit-bound', studio: 'Credit-bound', agency: 'Credit-bound' },
  { feature: 'Animated episodes', free: false, own_keys: 'On your key', starter: true, pro: true, studio: true, agency: true },
  { feature: '720p or 1080p animation', free: false, own_keys: true, starter: true, pro: true, studio: true, agency: true },
  { feature: 'Premium AI voice (hosted)', free: false, own_keys: 'Via top-up', starter: true, pro: true, studio: true, agency: true },
  { feature: 'Choose the script model (Claude, OpenAI, Gemini)', free: false, own_keys: true, starter: true, pro: true, studio: true, agency: true },
  { feature: 'Bring your own API keys', free: false, own_keys: 'Required', starter: true, pro: true, studio: true, agency: true },
  { feature: 'Platform fee on own-key runs', free: false, own_keys: 'None', starter: `${UNIT_CREDITS.byokPlatformFee} credits`, pro: 'None', studio: 'None', agency: 'None' },
  { feature: 'Credit top-ups available', free: true, own_keys: true, starter: true, pro: true, studio: true, agency: true },
  { feature: 'Unused credits roll over', free: false, own_keys: false, starter: '1 month', pro: '1 month', studio: '1 month', agency: '1 month' },
  { feature: 'Yearly billing (2 months free)', free: false, own_keys: true, starter: true, pro: true, studio: true, agency: true },
  { feature: 'Support', free: 'Community', own_keys: 'Email', starter: 'Email', pro: 'Email', studio: 'Priority', agency: 'Priority + onboarding' },
]

// What a credit actually buys. Every number comes from @lib/creditCosts, which
// `scripts/test_marketing_credit_costs.py` checks against core/pricing.py, so this
// table can no longer advertise a price the backend does not charge.
//
// The per-month columns are derived, not hand-computed: floor(allowance / cost).
const recipes = [
  {
    output: 'Vertical Short (stock footage)',
    credits: UNIT_CREDITS.shortStock,
    free: perMonth('free', UNIT_CREDITS.shortStock),
    pro: perMonth('pro', UNIT_CREDITS.shortStock),
  },
  {
    output: 'Long-form video, standard voice',
    credits: UNIT_CREDITS.longformStock,
    free: perMonth('free', UNIT_CREDITS.longformStock),
    pro: perMonth('pro', UNIT_CREDITS.longformStock),
  },
  {
    output: 'Long-form video, premium AI voice',
    credits: UNIT_CREDITS.longformPremium,
    free: perMonth('free', UNIT_CREDITS.longformPremium),
    pro: perMonth('pro', UNIT_CREDITS.longformPremium),
  },
  // Animated episodes are priced per generated scene, not per episode, so these
  // are quotes for a stated length rather than one price. Showing the flat
  // `anime_longform` gate of 180 here is what contradicted the note above.
  {
    output: `Animated episode (${ANIMATED_EPISODE.minutes} min, ~30% of scenes)`,
    credits: ANIMATED_EPISODE.defaultCredits,
    free: null,
    pro: perMonth('pro', ANIMATED_EPISODE.defaultCredits),
  },
  {
    output: `Animated episode (${ANIMATED_EPISODE.minutes} min, every scene)`,
    credits: ANIMATED_EPISODE.fullCredits,
    free: null,
    pro: perMonth('pro', ANIMATED_EPISODE.fullCredits),
  },
]

function Cell({ val }: { val: string | boolean | undefined }) {
  if (val === true) return <Check size={16} className="text-green-500 mx-auto" />
  if (val === false) return <Minus size={16} className="text-gray-500 mx-auto" />
  return <span className="text-sm text-gray-600">{val}</span>
}

export default function PricingPage() {
  const [yearly, setYearly] = useState(false)
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Pricing"
        description={`Credit-based pricing for AI YouTube automation. Start free with ${PLAN_CREDITS.free} credits plus ${FREE_REFILL.monthly} every month, bring your own AI keys for $${PLAN_PRICE_USD.own_keys}/mo, or get hosted credits from $${PLAN_PRICE_USD.starter}/mo. A Short costs ${UNIT_CREDITS.shortStock} credits, a long-form video ${UNIT_CREDITS.longformStock}, and an animated episode ~${ANIMATED_EPISODE.defaultCredits} for ${ANIMATED_EPISODE.minutes} minutes. Pay yearly and get two months free.`}
        path="/pricing"
      />

      {/* Hero */}
      <main className="flex flex-1 flex-col">
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 56 }}>
          <p className="font-semibold uppercase text-sky-700" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}>
            Pricing
          </p>
          <h1
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(2.25rem, 4.6vw, 3.25rem)', lineHeight: 1.06, letterSpacing: '-0.03em', maxWidth: 760 }}
          >
            Pay for what you make.
            <br />
            Not for what you don&apos;t.
          </h1>
          <p className="text-gray-500" style={{ fontSize: 17, lineHeight: 1.7, marginTop: 18, maxWidth: 680 }}>
            Every plan comes with credits. A Short costs {UNIT_CREDITS.shortStock}, a long-form
            video costs {UNIT_CREDITS.longformStock}, and an animated episode is priced by how many
            scenes you animate — about {ANIMATED_EPISODE.defaultCredits} credits for a{' '}
            {ANIMATED_EPISODE.minutes}-minute episode, up to {ANIMATED_EPISODE.fullCredits} if you
            animate every scene. You always see the exact cost before you render. Unused credits
            roll over for a month.
          </p>
          <p className="text-gray-500" style={{ fontSize: 13.5, lineHeight: 1.7, marginTop: 16 }}>
            Month-to-month, or pay yearly and get two months free. Cancel any time. Already pay
            for Claude, OpenAI, Gemini, Kling or ElevenLabs?{' '}
            <Link to="/app/settings" className="font-semibold text-sky-700 hover:underline">
              Connect your own key
            </Link>{' '}
            and you are only charged for the parts of a render that run on ours. Or skip credits
            entirely with the ${PLAN_PRICE_USD.own_keys} Own Keys plan.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="border-b border-gray-100">
        {/* `max-w-6xl` gave each of the five columns 205px -- about 153px of text --
            so 18 feature bullets wrapped to three or more lines and "Animated kids
            episodes (Kling)" broke to one word per line. `max-w-7xl` plus tighter
            card padding buys back ~45px of text width per card. */}
        <div className="mx-auto" style={{ maxWidth: 1280, padding: '56px 24px 40px' }}>
          <div className="max-w-7xl mx-auto flex justify-center" style={{ marginBottom: 28 }}>
            <div className="inline-flex rounded-lg border border-gray-200 p-1" role="group" aria-label="Billing interval">
              {[false, true].map((y) => (
                <button
                  key={String(y)}
                  type="button"
                  onClick={() => setYearly(y)}
                  aria-pressed={yearly === y}
                  className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${yearly === y ? 'bg-navy-600 text-white' : 'text-gray-600 hover:text-navy-600'}`}
                >
                  {y ? 'Yearly · 2 months free' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 16 }}>
            {plans.map((plan) => {
              const monthly = PLAN_PRICE_USD[plan.id] ?? 0
              const annual = yearly ? PLAN_PRICE_ANNUAL_USD[plan.id] : undefined
              const shown = annual ? annual / 12 : monthly
              return (
                <div
                  key={plan.name}
                  className={`flex flex-col rounded-[14px] border-2 ${plan.highlight ? 'border-navy-600' : 'border-gray-200'}`}
                  style={{ padding: 20 }}
                >
                  {plan.badge && (
                    <p
                      className="font-bold uppercase text-navy-600"
                      style={{ fontSize: 10.5, letterSpacing: '0.1em', marginBottom: 12 }}
                    >
                      {plan.badge}
                    </p>
                  )}
                  <p className="font-semibold text-gray-500" style={{ fontSize: 13, marginBottom: 6 }}>{plan.name}</p>
                  <p
                    className="font-bold text-navy-600"
                    style={{ fontSize: 29, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 6 }}
                  >
                    {monthly === 0 ? 'Free' : `$${_usd(shown)}`}
                    {monthly > 0 && (
                      <span className="font-normal text-gray-500" style={{ fontSize: 15 }}>/mo</span>
                    )}
                  </p>
                  {annual ? (
                    <p className="text-gray-500" style={{ fontSize: 12, marginBottom: 6 }}>
                      ${_usd(annual)} billed yearly
                    </p>
                  ) : null}
                  {/* sky-700 rather than sky-600: this is 13px text, and sky-600 on
                      white measures about 3.4:1 -- under the 4.5:1 body-text floor. */}
                  <p className="font-semibold text-sky-700" style={{ fontSize: 13, marginBottom: 6 }}>
                    {plan.creditsLine}
                  </p>
                  <p className="text-gray-500" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                    {plan.description}
                  </p>
                  <ul className="flex-1" style={{ display: 'grid', gap: 9, marginBottom: 20 }}>
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start text-gray-600"
                        style={{ gap: 8, fontSize: 12.5, lineHeight: 1.5 }}
                      >
                        <Check size={13} className="text-green-500 flex-shrink-0" style={{ marginTop: 2 }} /> {f}
                      </li>
                    ))}
                    {plan.limits?.map((f) => (
                      <li
                        key={f}
                        className="flex items-start text-gray-500"
                        style={{ gap: 8, fontSize: 12.5, lineHeight: 1.5 }}
                      >
                        <Minus size={13} className="text-gray-500 flex-shrink-0" style={{ marginTop: 2 }} /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={plan.ctaTo}
                    className={`w-full text-center py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap border transition-colors ${plan.highlight ? 'border-navy-600 bg-navy-600 text-white hover:border-navy-700 hover:bg-navy-700' : 'border-gray-200 text-navy-600 hover:border-navy-400'}`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              )
            })}
          </div>
          {/* EU consumer law requires the total price, including any tax, to be
              clear before purchase. VAT depends on the customer's country, so it
              is added and shown at checkout rather than guessed here. It was
              text-gray-500 (about 2.5:1) -- too faint for a legally required
              disclosure. */}
          <p
            className="max-w-7xl mx-auto text-center text-gray-500"
            style={{ fontSize: 12.5, lineHeight: 1.65, marginTop: 20 }}
          >
            Yearly plans are billed once a year; credits are still granted every month.
            Prices are in USD. VAT or sales tax is added at checkout where it applies, and shown
            before you pay — the amount you confirm is the total you are charged.
          </p>
        </div>
      </section>

      {/* What credits buy */}
      <section className="border-y border-gray-100 bg-[#FAFBFC]">
        <div className="site-container" style={{ maxWidth: 1000, paddingTop: 56, paddingBottom: 64 }}>
          <h2 className="font-bold text-navy-600" style={{ fontSize: 22, letterSpacing: '-0.02em', marginBottom: 8 }}>
            What your credits buy
          </h2>
          <p className="text-gray-500" style={{ fontSize: 14, marginBottom: 32 }}>
            You are charged per render, and the cost is shown before you start. Nothing is deducted
            for a render that fails.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th scope="col" className="text-left py-3 pr-6 text-sm font-semibold text-gray-500">Output</th>
                  <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-navy-600">Credits each</th>
                  <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-navy-600">Free ({PLAN_CREDITS.free})</th>
                  <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-navy-600">Pro ({_fmt(PLAN_CREDITS.pro)})</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((r, i) => (
                  <tr key={r.output} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="py-3 pr-6 text-sm text-gray-600">{r.output}</td>
                    <td className="py-3 px-4 text-center text-sm font-semibold text-navy-600">{r.credits}</td>
                    <td className="py-3 px-4 text-center text-sm text-gray-600">
                      {r.free === null ? <Minus size={16} className="text-gray-500 mx-auto" /> : `~${r.free}`}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-600">~{r.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Counts are approximate — long-form videos cost more when the script is longer, and a
            re-render of an individual animated scene costs {UNIT_CREDITS.animeScene}.
          </p>
          <p className="text-sm text-gray-600 mt-3" style={{ lineHeight: 1.7 }}>
            <strong className="text-navy-600">On your own keys</strong> you pay only for the parts of a
            render that run on ours — for example the voice and music on an animated episode whose
            clips come from your Kling key. Starter adds a {UNIT_CREDITS.byokPlatformFee}-credit
            platform fee per run; Own Keys, Pro, Studio and Agency pay no fee.{' '}
            <Link to="/guides/api-keys" className="text-sky-700 hover:underline">How to get each API key</Link>.
          </p>
        </div>
      </section>

      {/* Entitlements table */}
      <section>
        <div className="site-container" style={{ maxWidth: 1000, paddingTop: 56, paddingBottom: 64 }}>
          <h2 className="font-bold text-navy-600" style={{ fontSize: 22, letterSpacing: '-0.02em', marginBottom: 28 }}>
            Plan entitlements
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 820 }}>
              <thead>
                <tr className="border-b border-gray-200">
                  <th scope="col" className="text-left py-3 pr-6 text-sm font-semibold text-gray-500">Feature</th>
                  {plans.map((p) => (
                    <th key={p.name} scope="col" className="py-3 px-3 text-center text-sm font-semibold text-navy-600">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entitlements.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="py-3 pr-6 text-sm text-gray-600" style={{ minWidth: 200 }}>{row.feature}</td>
                    {plans.map((p) => (
                      <td key={p.id} className="py-3 px-3 text-center"><Cell val={row[p.id]} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ strip */}
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 72 }}>
          <h2
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(1.5rem, 2.6vw, 1.9rem)', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 28 }}
          >
            Billing questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '28px 40px' }}>
            {[
              { q: 'What is a credit?', a: `A credit is one unit of rendering. A vertical Short costs ${UNIT_CREDITS.shortStock}, a long-form video costs ${UNIT_CREDITS.longformStock}, a long-form video with a premium AI voice costs ${UNIT_CREDITS.longformPremium}, and an animated episode is priced by how many scenes you animate — roughly ${ANIMATED_EPISODE.defaultCredits} credits for a ${ANIMATED_EPISODE.minutes}-minute episode, up to ${ANIMATED_EPISODE.fullCredits} if you animate every scene. The exact cost is shown before you start each render, and nothing is deducted if a render fails.` },
              { q: 'What happens when I run out of credits?', a: 'Renders that you cannot afford are blocked before they start, with a message showing the cost and your balance. You can buy a top-up without changing plan, or upgrade — both take effect immediately.' },
              { q: 'Can I use my own API keys?', a: `Yes, on every paid plan. Connect your Claude, OpenAI, Gemini, Kling, MiniMax or ElevenLabs key in Settings. We charge only for the parts of a render that still run on our keys — for example the voice and music on an animated episode whose clips come from your Kling key. Starter adds a ${UNIT_CREDITS.byokPlatformFee}-credit platform fee per run; Pro and above pay none.` },
              { q: 'What is the Own Keys plan?', a: `$${PLAN_PRICE_USD.own_keys}/mo ($${_usd(PLAN_PRICE_ANNUAL_USD.own_keys / 12)}/mo yearly) for creators who already pay for AI. Your own Claude, OpenAI or Gemini key writes the scripts, and we handle rendering, uploading, scheduling and posting — up to ${OWN_KEYS_RENDER_CAP} renders a month on ${channelPhrase('own_keys')}. No credits are included, but you can buy a top-up to use our keys for a single job.` },
              { q: 'Is animation on the Free plan?', a: 'No. Animated episodes need a paid plan — Own Keys (on your own Kling or MiniMax key) or any credit plan from Starter up. Free covers stock-footage Shorts and long-form videos.' },
              { q: 'Do unused credits roll over?', a: `On credit plans, unused credits roll over for one month, then expire. Free accounts get ${FREE_REFILL.monthly} more credits every month, up to a balance of ${FREE_REFILL.cap}.` },
              { q: 'Is there yearly billing?', a: 'Yes. Every paid plan can be billed yearly for the price of ten months. Your credits are still granted monthly, and unused ones roll over the same way.' },
              { q: 'Can I cancel at any time?', a: 'Yes. Cancel from your billing settings in one click. You keep access until the end of your billing period and there are no fees.' },
              { q: 'Do you offer refunds?', a: `14-day money-back guarantee on the first charge of any paid plan. Contact ${SUPPORT_EMAIL} within 14 days.` },
            ].map((item) => (
              <div key={item.q}>
                <p className="font-semibold text-navy-600" style={{ fontSize: 15, marginBottom: 6 }}>{item.q}</p>
                <p className="text-gray-500" style={{ fontSize: 14, lineHeight: 1.7 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy-600">
        <div className="site-container text-center" style={{ paddingTop: 72, paddingBottom: 72 }}>
          <h2
            className="font-bold text-white"
            style={{ fontSize: 'clamp(1.7rem, 3vw, 2.2rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}
          >
            Start with the free credits.
          </h2>
          <p className="text-sky-200" style={{ fontSize: 16.5, lineHeight: 1.6, marginTop: 12 }}>
            {_fmt(PLAN_CREDITS.free)} credits plus {FREE_REFILL.monthly} more every month, no card
            required — and the exact cost is shown before every render.
          </p>
          <div className="flex flex-col sm:flex-row justify-center" style={{ gap: 12, marginTop: 26 }}>
            <Link to="/signup" className="btn-primary btn-lg btn-inverse">
              Start free <ArrowRight size={17} />
            </Link>
            <Link to="/contact" className="btn-secondary btn-lg btn-outline-inverse">
              Contact sales
            </Link>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  )
}
