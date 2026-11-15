import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { ArrowRight, Check, Minus } from 'lucide-react'
import { SUPPORT_EMAIL } from '@lib/site'
import { ANIMATED_EPISODE, PLAN_CREDITS, UNIT_CREDITS, channelCount, channelPhrase, perMonth } from '@lib/creditCosts'

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

const plans = [
  {
    name: 'Free', price: 0, credits: _fmt(PLAN_CREDITS.free), creditsNote: 'one-time',
    description: 'Make your first video free. No card required.',
    cta: 'Start free', ctaTo: '/signup', highlight: false,
    features: [
      `${PLAN_CREDITS.free} credits to start (one-time)`,
      channelPhrase('free', 'YouTube channel'),
      'AI scripts, titles, descriptions & tags',
      'Standard voiceovers (no key needed)',
      'Stock footage, auto upload to YouTube',
    ],
  },
  {
    name: 'Starter', price: 19, credits: _fmt(PLAN_CREDITS.starter), creditsNote: '/ month',
    description: 'For creators publishing regularly.',
    cta: 'Start Starter', ctaTo: '/signup', highlight: false,
    features: [
      `${_fmt(PLAN_CREDITS.starter)} credits / month`,
      channelPhrase('starter', 'YouTube channel'),
      'Everything in Free',
      'Premium AI voiceovers (ElevenLabs)',
      'Vertical Shorts from one script',
      'Unused credits roll over one month',
    ],
  },
  {
    name: 'Pro', price: 49, credits: _fmt(PLAN_CREDITS.pro), creditsNote: '/ month', badge: 'Most popular',
    description: 'For creators scaling across channels.',
    cta: 'Start Pro', ctaTo: '/signup', highlight: true,
    features: [
      `${_fmt(PLAN_CREDITS.pro)} credits / month`,
      channelPhrase('pro', 'YouTube channel'),
      'Everything in Starter',
      'Animated kids episodes (Kling)',
      'Scheduler, queue & content calendar',
      'Analytics + auto-post to IG, FB, TikTok, Telegram & Reddit',
      'Email support',
    ],
  },
  {
    name: 'Studio', price: 99, credits: _fmt(PLAN_CREDITS.studio), creditsNote: '/ month',
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
    name: 'Agency', price: 299, credits: _fmt(PLAN_CREDITS.agency), creditsNote: '/ month',
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

// Entitlements, not a feature matrix. Credits are the real currency, so gating
// features per tier would be fiction -- what differs between packages is how many
// credits you get and how many channels you can attach to them.
const entitlements = [
  {
    feature: 'Monthly credits',
    free: `${PLAN_CREDITS.free} one-time`,
    starter: _fmt(PLAN_CREDITS.starter),
    pro: _fmt(PLAN_CREDITS.pro),
    studio: _fmt(PLAN_CREDITS.studio),
    agency: _fmt(PLAN_CREDITS.agency),
  },
  { feature: 'YouTube channels', free: channelCount('free'), starter: channelCount('starter'), pro: channelCount('pro'), studio: channelCount('studio'), agency: channelCount('agency') },
  { feature: 'Unused credits roll over', free: false, starter: '1 month', pro: '1 month', studio: '1 month', agency: '1 month' },
  { feature: 'Bring your own API keys (BYOK)', free: true, starter: true, pro: true, studio: true, agency: true },
  { feature: 'Credit top-ups available', free: true, starter: true, pro: true, studio: true, agency: true },
  { feature: 'Support', free: 'Community', starter: 'Email', pro: 'Email', studio: 'Priority', agency: 'Priority + onboarding' },
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

function Cell({ val }: { val: string | boolean }) {
  if (val === true) return <Check size={16} className="text-green-500 mx-auto" />
  if (val === false) return <Minus size={16} className="text-gray-500 mx-auto" />
  return <span className="text-sm text-gray-600">{val}</span>
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Pricing"
        description={`Credit-based pricing for AI YouTube automation. Start free with ${PLAN_CREDITS.free} credits, then scale from $19/mo. A Short costs ${UNIT_CREDITS.shortStock} credits, a long-form video ${UNIT_CREDITS.longformStock}, and an animated episode is priced by how many scenes you animate (~${ANIMATED_EPISODE.defaultCredits} for ${ANIMATED_EPISODE.minutes} minutes). Bring your own Kling or ElevenLabs key and animated episodes drop to ${UNIT_CREDITS.byokPlatformFee}.`}
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
            Month-to-month. Cancel any time. Already have a Kling or ElevenLabs account?{' '}
            <Link to="/app/settings" className="font-semibold text-sky-700 hover:underline">
              Connect your own key
            </Link>{' '}
            {/* Derived, not typed. This read "drop to a 2-credit platform fee" as a
                literal while the meta description above already derived the same
                figure -- so the visible price could drift from the charged one. */}
            and animated episodes drop to a {UNIT_CREDITS.byokPlatformFee}-credit platform fee.
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
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5" style={{ gap: 16 }}>
            {plans.map((plan) => {
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
                    {plan.price === null ? 'Custom' : plan.price === 0 ? 'Free' : `$${plan.price}`}
                    {plan.price !== null && plan.price > 0 && (
                      <span className="font-normal text-gray-500" style={{ fontSize: 15 }}>/mo</span>
                    )}
                  </p>
                  {/* sky-700 rather than sky-600: this is 13px text, and sky-600 on
                      white measures about 3.4:1 -- under the 4.5:1 body-text floor. */}
                  <p className="font-semibold text-sky-700" style={{ fontSize: 13, marginBottom: 6 }}>
                    {plan.credits} <span className="font-normal text-gray-500">credits {plan.creditsNote}</span>
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
                  <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-navy-600">Free (40)</th>
                  <th scope="col" className="py-3 px-4 text-center text-sm font-semibold text-navy-600">Pro (900)</th>
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
                <tr className="bg-white border-t border-gray-200">
                  <td className="py-3 pr-6 text-sm text-gray-600">
                    Any render, using your own Kling / ElevenLabs key
                  </td>
                  <td className="py-3 px-4 text-center text-sm font-semibold text-sky-600">
                    {UNIT_CREDITS.byokPlatformFee}
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-gray-600">
                    ~{perMonth('free', UNIT_CREDITS.byokPlatformFee)}
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-gray-600">
                    ~{perMonth('pro', UNIT_CREDITS.byokPlatformFee)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Counts are approximate — long-form videos cost more when the script is longer, and a
            re-render of an individual animated scene costs {UNIT_CREDITS.animeScene}.
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
            <table className="w-full">
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
                    <td className="py-3 pr-6 text-sm text-gray-600">{row.feature}</td>
                    <td className="py-3 px-3 text-center"><Cell val={row.free} /></td>
                    <td className="py-3 px-3 text-center"><Cell val={row.starter} /></td>
                    <td className="py-3 px-3 text-center"><Cell val={row.pro} /></td>
                    <td className="py-3 px-3 text-center"><Cell val={row.studio} /></td>
                    <td className="py-3 px-3 text-center"><Cell val={row.agency} /></td>
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
              { q: 'Can I use my own Kling or ElevenLabs API key?', a: `Yes, and it is worth doing if you already pay for either. Connect your key in Settings and an animated episode drops from ~${ANIMATED_EPISODE.defaultCredits} credits to a ${UNIT_CREDITS.byokPlatformFee}-credit platform fee — you keep full control of your own provider spend.` },
              { q: 'Do unused credits roll over?', a: 'On paid plans, unused credits roll over for one month, then expire. Free credits are one-time and do not roll over.' },
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
            {_fmt(PLAN_CREDITS.free)} credits, no card required — and the exact cost is shown
            before every render.
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
