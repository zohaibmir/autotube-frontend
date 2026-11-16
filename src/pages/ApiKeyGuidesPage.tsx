import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { ExternalLink } from 'lucide-react'
import { API_KEY_GUIDES, formatProviderCost, type ProviderCost } from '@content/apiKeyGuides'
import { publicApi } from '@api/services'
import { PLAN_PRICE_USD } from '@lib/creditCosts'

const STAGE_ORDER = ['script', 'voice', 'animation', 'visuals', 'music'] as const
const STAGE_HEADINGS: Record<(typeof STAGE_ORDER)[number], string> = {
  script: 'Script writing',
  voice: 'Voice',
  animation: 'Animation',
  visuals: 'Images and stock footage',
  music: 'Music',
}

export default function ApiKeyGuidesPage() {
  // Costs come from the API (computed from core/pricing.py) and load after the
  // prerendered page, so the guide text is indexable without them.
  const [costs, setCosts] = useState<Record<string, ProviderCost>>({})
  useEffect(() => {
    let alive = true
    publicApi.apiKeyCosts()
      .then(data => { if (alive) setCosts(data.providers ?? {}) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to get an API key for Kling, Claude, OpenAI, Gemini, ElevenLabs and MiniMax',
    step: API_KEY_GUIDES.map(g => ({
      '@type': 'HowToSection',
      name: g.name,
      itemListElement: g.steps.map(text => ({ '@type': 'HowToStep', text })),
    })),
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="How to get your AI API keys"
        description="Step-by-step guides to create API keys for Kling, MiniMax, Claude, OpenAI, Gemini, ElevenLabs, Pexels and Replicate, with the typical cost per video on each."
        path="/guides/api-keys"
        jsonLd={howTo}
      />

      <main className="flex flex-1 flex-col">
        <section className="border-b border-gray-100">
          <div className="site-container" style={{ paddingTop: 72, paddingBottom: 56 }}>
            <p className="font-semibold uppercase text-sky-700" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}>
              Guides
            </p>
            <h1
              className="font-bold text-navy-600"
              style={{ fontSize: 'clamp(2.25rem, 4.6vw, 3.25rem)', lineHeight: 1.06, letterSpacing: '-0.03em' }}
            >
              How to get your API keys.
            </h1>
            <p className="text-gray-500" style={{ fontSize: 17, lineHeight: 1.7, marginTop: 18, maxWidth: 660 }}>
              Bring your own keys and each provider bills you directly; we only charge credits for the parts
              of a render that still run on ours. The Own Keys plan (${PLAN_PRICE_USD.own_keys}/month) is built
              for this. You need one script key (Claude, OpenAI or Gemini); everything else is optional.
              Paste keys in Settings → API Keys once you have an account. Costs below are typical provider
              charges, not Vidora prices.
            </p>
          </div>
        </section>

        {STAGE_ORDER.map(stage => {
          const guides = API_KEY_GUIDES.filter(g => g.stage === stage)
          if (!guides.length) return null
          return (
            <section key={stage} className="border-b border-gray-100">
              <div className="site-container" style={{ paddingTop: 48, paddingBottom: 48 }}>
                <h2 className="font-semibold text-navy-600" style={{ fontSize: 22, marginBottom: 24 }}>
                  {STAGE_HEADINGS[stage]}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 24 }}>
                  {guides.map(g => {
                    const cost = formatProviderCost(costs[g.id])
                    return (
                      <article key={g.id} id={g.id} className="border border-gray-200 rounded-xl scroll-mt-24" style={{ padding: 24 }}>
                        <h3 className="font-semibold text-navy-600" style={{ fontSize: 17 }}>
                          {g.name}: how to get an API key
                        </h3>
                        <p className="text-gray-500" style={{ fontSize: 14, marginTop: 4 }}>{g.description}</p>
                        <ol className="list-decimal text-gray-700" style={{ fontSize: 14, lineHeight: 1.65, marginTop: 14, paddingLeft: 18 }}>
                          {g.steps.map(step => <li key={step}>{step}</li>)}
                        </ol>
                        {cost && <p className="text-gray-700" style={{ fontSize: 13, marginTop: 12 }}>{cost}.</p>}
                        {g.caveats.map(c => (
                          <p key={c} className="text-gray-500" style={{ fontSize: 13, marginTop: 6 }}>Note: {c}</p>
                        ))}
                        <a
                          href={g.consoleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-sky-700 hover:underline"
                          style={{ fontSize: 13, marginTop: 14 }}
                        >
                          Open the {g.name} console <ExternalLink size={12} />
                        </a>
                      </article>
                    )
                  })}
                </div>
              </div>
            </section>
          )
        })}

        <section>
          <div className="site-container" style={{ paddingTop: 48, paddingBottom: 72 }}>
            <p className="text-gray-600" style={{ fontSize: 15, lineHeight: 1.7, maxWidth: 660 }}>
              Not sure whether your own keys or our credits work out cheaper? See{' '}
              <Link to="/pricing" className="text-sky-700 hover:underline">pricing</Link> or read{' '}
              <Link to="/blog/byok-vs-platform-credits-ai-video-budget" className="text-sky-700 hover:underline">
                BYOK vs platform credits
              </Link>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
