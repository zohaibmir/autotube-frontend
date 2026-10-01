import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { Check, Minus } from 'lucide-react'

const plans = [
  {
    name: 'Free', price: { monthly: 0, annual: 0 }, description: 'Try the platform at no cost.',
    cta: 'Get started free', ctaTo: '/signup', highlight: false,
    features: ['5 videos / month', '1 YouTube channel', 'Basic AI scripts', 'Standard voiceovers', 'YouTube upload', '720p output', 'Community support'],
    missing: ['Social distribution', 'Custom voice', 'Priority processing', 'Analytics dashboard', 'API access'],
  },
  {
    name: 'Pro', price: { monthly: 49, annual: 39 }, description: 'For creators scaling their output.', badge: 'Most popular',
    cta: 'Start Pro trial', ctaTo: '/signup', highlight: true,
    features: ['50 videos / month', '5 YouTube channels', 'Advanced AI scripts + SEO', 'Premium voiceovers (20+ voices)', 'YouTube + Shorts upload', '1080p output', 'Instagram Reels & TikTok', 'Analytics dashboard', 'Email support (24h)'],
    missing: ['Unlimited videos', 'Custom API', 'Dedicated account manager'],
  },
  {
    name: 'Enterprise', price: { monthly: null, annual: null }, description: 'For agencies with high volume.',
    cta: 'Contact sales', ctaTo: '/contact', highlight: false,
    features: ['Unlimited videos', 'Unlimited channels', 'Custom AI fine-tuning', 'All voices + custom clone', 'All platforms', '4K output', 'Full API access', 'Analytics + custom reports', 'Dedicated account manager', 'SLA + priority processing'],
    missing: [],
  },
]

const comparison = [
  { feature: 'Videos per month', free: '5', pro: '50', enterprise: 'Unlimited' },
  { feature: 'YouTube channels', free: '1', pro: '5', enterprise: 'Unlimited' },
  { feature: 'Output quality', free: '720p', pro: '1080p', enterprise: '4K' },
  { feature: 'AI script quality', free: 'Basic', pro: 'Advanced + SEO', enterprise: 'Custom fine-tuned' },
  { feature: 'Voiceover voices', free: '3', pro: '20+', enterprise: 'All + custom clone' },
  { feature: 'Social distribution', free: false, pro: true, enterprise: true },
  { feature: 'Analytics dashboard', free: false, pro: true, enterprise: true },
  { feature: 'API access', free: false, pro: false, enterprise: true },
  { feature: 'Support', free: 'Community', pro: '24h email', enterprise: 'Dedicated + SLA' },
]

function Cell({ val }: { val: string | boolean }) {
  if (val === true) return <Check size={16} className="text-green-500 mx-auto" />
  if (val === false) return <Minus size={16} className="text-gray-200 mx-auto" />
  return <span className="text-sm text-gray-600">{val}</span>
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Pricing"
        description="Simple, predictable pricing for AI YouTube automation. Start free with 5 videos a month, upgrade to Pro for multi-platform distribution and analytics, or go Enterprise for unlimited channels."
        path="/pricing"
      />

      {/* Hero */}
      <section className="pt-28 pb-20 px-6 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-sky-500 font-semibold text-sm uppercase tracking-widest mb-5">Pricing</p>
          <h1 className="text-5xl font-bold text-navy-600 leading-[1.1] mb-5">
            Simple pricing.<br />No surprises.
          </h1>
          <p className="text-xl text-gray-500 mb-8 max-w-xl">
            Start free, scale when ready. No hidden fees, no per-video charges.
          </p>
          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${!annual ? 'bg-navy-600 text-white' : 'text-gray-500 hover:text-navy-600'}`}
            >Monthly</button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${annual ? 'bg-navy-600 text-white' : 'text-gray-500 hover:text-navy-600'}`}
            >Annual <span className="text-xs opacity-70 ml-1">–20%</span></button>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const price = annual ? plan.price.annual : plan.price.monthly
            return (
              <div
                key={plan.name}
                className={`rounded-xl border-2 p-8 flex flex-col ${plan.highlight ? 'border-navy-600' : 'border-gray-200'}`}
              >
                {plan.badge && (
                  <p className="text-xs font-bold text-navy-600 uppercase tracking-widest mb-4">{plan.badge}</p>
                )}
                <p className="text-sm font-semibold text-gray-500 mb-1">{plan.name}</p>
                <p className="text-4xl font-bold text-navy-600 mb-1">
                  {price === null ? 'Custom' : price === 0 ? 'Free' : `$${price}`}
                  {price !== null && price > 0 && <span className="text-base font-normal text-gray-400">/mo</span>}
                </p>
                {annual && price !== null && price > 0 && (
                  <p className="text-xs text-gray-400 mb-1">billed annually</p>
                )}
                <p className="text-sm text-gray-500 mb-6">{plan.description}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.ctaTo}
                  className={`w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-colors ${plan.highlight ? 'bg-navy-600 text-white hover:bg-navy-700' : 'border border-gray-200 text-navy-600 hover:border-navy-400'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-16 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-navy-600 mb-10">Full comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th scope="col" className="text-left py-3 pr-6 text-sm font-semibold text-gray-500 w-1/2">Feature</th>
                  {plans.map((p) => (
                    <th key={p.name} scope="col" className="py-3 px-4 text-center text-sm font-semibold text-navy-600">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="py-3 pr-6 text-sm text-gray-600">{row.feature}</td>
                    <td className="py-3 px-4 text-center"><Cell val={row.free} /></td>
                    <td className="py-3 px-4 text-center"><Cell val={row.pro} /></td>
                    <td className="py-3 px-4 text-center"><Cell val={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ strip */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-navy-600 mb-10">Billing questions</h2>
          <div className="space-y-8">
            {[
              { q: 'Can I cancel at any time?', a: 'Yes. Cancel from your billing settings in one click. You keep access until the end of your billing period. No fees.' },
              { q: 'What happens if I exceed my quota?', a: 'New jobs are paused when you hit your monthly limit. You can upgrade mid-month - overage is prorated.' },
              { q: 'Do you offer refunds?', a: '14-day money-back guarantee on the first charge of any paid plan. Contact support@ytautomation.io within 14 days.' },
            ].map((item) => (
              <div key={item.q}>
                <p className="font-semibold text-navy-600 mb-1.5 text-sm">{item.q}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
