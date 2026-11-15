import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { SUPPORT_EMAIL } from '@lib/site'

const LAST_UPDATED = '11 October 2026'

// ─────────────────────────────────────────────────────────────────────────────
// NOTE FOR MAINTAINERS
//
// Engineer-written draft, not legal advice. The processor list below mirrors
// what the code actually calls (Supabase, Stripe, Anthropic, ElevenLabs, Kling,
// Pexels, Google/YouTube, the social platforms, Sentry, and R2/Azure depending
// on STORAGE_BACKEND). Keep it in step with `api/key_resolver.py` and
// `core/music_providers.py` when providers change.
//
// Have counsel review before relying on it -- retention periods, the lawful-
// basis wording and the international-transfer clause in particular.
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: '1. In short',
    body: [
      'We collect what we need to run your account and produce your videos: your email and login, the API keys you choose to connect, the content you generate, and usage records so we can meter credits. We do not sell your data, and we do not use your content to train models.',
    ],
  },
  {
    heading: '2. What we collect',
    body: [
      'Account data: your email address, display name, and a password hash. Authentication is handled by Supabase; we never store your password in readable form.',
      'Connected-account data: if you connect YouTube or a social platform, we store the OAuth access and refresh tokens needed to publish on your behalf, encrypted at rest. We also store the channel identifiers you connect.',
      'Your content: the topics, scripts, prompts and settings you supply, and the videos, thumbnails and audio we generate for you.',
      'Bring-your-own-key data: provider API keys you add, encrypted at rest, used only to run renders you request.',
      'Usage and cost data: a per-request ledger of which provider was called, how much it cost, and how many credits were charged. This is what makes the credit system auditable.',
      'Billing data: your plan, credit balance, and identifiers from Stripe. Card details go directly to Stripe and never reach our servers.',
      'Technical data: error reports and performance traces, if error monitoring is enabled on this deployment. These may include a user identifier and the request that failed.',
    ],
  },
  {
    heading: '3. How we use it',
    body: [
      'To provide the Service: authenticate you, generate and render your videos, publish to the destinations you choose, and meter credits against your balance.',
      'To bill you: manage plans, top-ups and invoices through Stripe.',
      'To keep it working and safe: detect abuse, enforce plan limits, diagnose failures, and meet legal obligations.',
      'We do not sell your personal data, and we do not use your content or your generated videos to train our own or anyone else\u2019s models.',
    ],
  },
  {
    heading: '3a. Our lawful bases (EU/UK)',
    body: [
      'Where the GDPR applies, we rely on the following bases. Performance of a contract (Art. 6(1)(b)) covers creating your account, producing and publishing your videos, and billing you \u2014 we cannot provide the Service without it. Legitimate interests (Art. 6(1)(f)) covers keeping the Service secure and working: abuse prevention, plan-limit enforcement, and error diagnostics, which we have balanced against your rights and which you can object to. Legal obligation (Art. 6(1)(c)) covers tax and accounting records. Consent (Art. 6(1)(a)) covers the one optional thing on the site, error session replays \u2014 see the Cookies page, where you can grant or withdraw it at any time.',
      'We do not carry out automated decision-making that produces legal or similarly significant effects, and we do not profile you for advertising.',
    ],
  },
  {
    heading: '3b. Error session replays',
    body: [
      'If error monitoring is enabled on this deployment, we can record a short replay of what is on screen when an error occurs, to reproduce and fix it. This only runs if you have accepted it on the Cookies page; it is off by default and stays off if you decline or ignore the banner.',
      'Even when enabled, text and form inputs are masked and images, audio and video are blocked, so a replay does not contain your scripts, your prompts or your API keys. Replays are retained by our error-monitoring provider for around 30 days and then deleted.',
    ],
  },
  {
    heading: '3c. Who is responsible for your data',
    body: [
      `The controller responsible for your personal data is Rihla AB, a Swedish limited company (aktiebolag) registered under company number 559589-5656, with its registered office (säte) in Sollentuna, Stockholm County, and its postal address at Mässvägen 13 A, lgh 1804, 191 61 Sollentuna, Sweden. You can reach us at ${SUPPORT_EMAIL}.`,
      'Because we are established in the EU (Sweden), we do not need to appoint a representative under GDPR Article 27. If we begin offering the Service to users in the UK, the UK GDPR requires us to appoint a UK representative; we will name them here before that happens. [PLACEHOLDER - confirm with counsel before serving UK consumers.]',
      'Our supervisory authority is the Swedish Authority for Privacy Protection (Integritetsskyddsmyndigheten, IMY). You can complain to IMY, or to the supervisory authority in your own country of residence.',
    ],
  },
  {
    heading: '4. Who else processes it',
    body: [
      'We share data with the processors needed to run the Service, and only to the extent needed:',
      'Supabase \u2014 authentication and database hosting. Stripe \u2014 payments and subscriptions. Anthropic \u2014 script, SEO and prompt generation. ElevenLabs \u2014 voiceover and music generation. Kling \u2014 animated video clips. Pexels \u2014 stock footage. Google / YouTube \u2014 channel connection and publishing. Meta, TikTok, Reddit, Telegram and X \u2014 social publishing, when you connect them. Sentry \u2014 error monitoring, where enabled. Cloudflare R2 or Azure Blob \u2014 media storage, depending on this deployment\u2019s configuration.',
      'When you use your own API key (BYOK), your content goes to that provider under your own account and their terms, and our role is limited to making the call.',
    ],
  },
  {
    heading: '5. Cookies and local storage',
    body: [
      'We use browser local storage to keep you signed in and to remember in-progress drafts, and a small number of cookies needed for authentication. We do not run third-party advertising trackers.',
    ],
  },
  {
    heading: '6. How long we keep it',
    body: [
      'Account data is kept while your account exists and is deleted when you delete the account from Settings.',
      'Your generated videos, audio and thumbnails are kept while your account exists so you can re-download or re-publish them. You can delete individual items, and account deletion removes the rest.',
      'Connected-account tokens are kept until you disconnect that channel or delete your account, whichever comes first.',
      'Usage and cost records are kept for accounting and to keep the credit system auditable. They are retained after account deletion in a form that no longer identifies you, then deleted on our normal accounting schedule.',
      'Billing records are kept as long as tax and accounting rules require. Swedish bookkeeping law (bokföringslagen) obliges us to retain accounting records for seven years, so invoices and credit purchases are kept for that period even after you close your account.',
    ],
  },
  {
    heading: '7. Your rights',
    body: [
      'Depending on where you live, you may have the right to access the personal data we hold about you, to correct it, to delete it, to receive a portable copy, to object to certain processing, and to withdraw consent where processing is based on consent.',
      `Account deletion is self-service: Settings \u2192 Account \u2192 Delete account. For anything else, email ${SUPPORT_EMAIL} and we will respond within the period your local law allows. You also have the right to complain to your local data-protection authority.`,
    ],
  },
  {
    heading: '8. Security',
    body: [
      'Passwords are hashed, API keys and OAuth tokens are encrypted at rest, and access to production data is limited. Every channel-scoped query is filtered by owner, so one account cannot read another\u2019s channels, tokens or content. No system is perfectly secure, and we cannot guarantee absolute security.',
    ],
  },
  {
    heading: '9. Children',
    body: [
      'The Service is not intended for children, and accounts are limited to adults as set out in our Terms. Some features help you produce content aimed at a young audience; that affects the content, not who may hold an account.',
    ],
  },
  {
    heading: '10. International transfers',
    body: [
      'We are established in the EU (Sweden). Several of our processors are in the United States and elsewhere, so your personal data is transferred outside the EEA. Where that happens we rely on the safeguards GDPR Chapter V requires: an adequacy decision where one applies (including the EU-US Data Privacy Framework for certified US importers), or the European Commission standard contractual clauses together with a transfer impact assessment where it does not.',
    ],
  },
  {
    heading: '11. Changes to this policy',
    body: [
      'If we make a material change we will notify you by email or in the app before it takes effect, and update the date at the top of this page.',
    ],
  },
  {
    heading: '12. Contact',
    body: [
      `For any privacy question or request: ${SUPPORT_EMAIL}.`,
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Privacy Policy"
        description="What Vidora collects, why, who processes it, how long we keep it, and how to exercise your rights."
        path="/privacy"
      />

      <main className="flex flex-1 flex-col">
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 64, paddingBottom: 40 }}>
          <p
            className="font-semibold uppercase text-sky-700"
            style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 12 }}
          >
            Legal
          </p>
          <h1
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.5rem)', lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: 12 }}
          >
            Privacy Policy
          </h1>
          <p className="text-gray-500" style={{ fontSize: 13.5 }}>Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="flex-1">
        <div
          className="site-container"
          style={{ maxWidth: 760, paddingTop: 48, paddingBottom: 72, display: 'grid', gap: 36 }}
        >
          {SECTIONS.map((s) => (
            <div key={s.heading}>
              <h2 className="font-bold text-navy-600" style={{ fontSize: 19, lineHeight: 1.35, marginBottom: 14 }}>
                {s.heading}
              </h2>
              {/* 16px at 1.75: these are long legal paragraphs, and the 16px/1.6
                  they used with `mb-3` (32px) between them was both too tight
                  within a paragraph and too loose between them. */}
              <div style={{ display: 'grid', gap: 14 }}>
                {s.body.map((p, i) => (
                  <p key={i} className="text-gray-500" style={{ fontSize: 16, lineHeight: 1.75 }}>{p}</p>
                ))}
              </div>
            </div>
          ))}
          {/* A draft notice is a legal caveat, not a footnote: it was 12px in the
              lightest treatment on the page. */}
          <p
            className="text-gray-600"
            style={{ fontSize: 13, lineHeight: 1.6, borderTop: '1px solid #E5E7EB', paddingTop: 20 }}
          >
            This page is a working draft and is pending legal review.
          </p>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  )
}
