import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { SUPPORT_EMAIL } from '@lib/site'

const LAST_UPDATED = '11 October 2026'

// ─────────────────────────────────────────────────────────────────────────────
// NOTE FOR MAINTAINERS
//
// This is a good-faith, product-accurate DRAFT written by an engineer, not a
// lawyer. It deliberately describes what the software actually does -- the data
// handled, the third-party processors, how credits work, how BYOK works --
// because a policy that contradicts the product is worse than none.
//
// Have counsel review it before relying on it. The governing-law clause, the
// liability cap and the refund terms in particular are placeholders that need a
// real decision. Signup links to this page, so it must exist -- but "exists" is
// not the same as "reviewed".
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: '1. Agreement',
    body: [
      'These terms govern your use of Vidora (the "Service"). By creating an account you agree to them. If you are agreeing on behalf of a company, you confirm you have authority to bind that company.',
    ],
  },
  {
    heading: '2. What the Service does',
    body: [
      'Vidora generates videos from a topic you supply: it writes a script, produces a voiceover, sources or generates visuals, renders the result, and can publish it to connected channels. The output is produced by third-party AI models, and quality varies. We do not guarantee that any given video will meet a particular standard, nor that any platform will accept it.',
    ],
  },
  {
    heading: '3. Your account',
    body: [
      'You are responsible for keeping your credentials secure and for everything done through your account. You must be at least 18, or the age of majority where you live, to hold an account.',
      "You may connect YouTube and social accounts. You confirm you have the right to publish to any channel or account you connect, and that doing so does not breach that platform's terms.",
    ],
  },
  {
    heading: '4. Credits, plans and billing',
    body: [
      'Rendering is metered in credits. Every plan includes a monthly credit allowance; additional credits can be purchased as one-off top-ups. Unused credits on paid plans roll over for one month, then expire. Free credits are one-time and do not roll over.',
      'The credit cost of a render is shown before you start it, and that is the amount charged. A render that fails is not charged.',
      'Paid plans are billed in advance through Stripe. We do not store your card details. You can cancel at any time from your billing settings and you keep access until the end of the period you have paid for.',
      'First charges on any paid plan are covered by a 14-day money-back guarantee. Contact support within 14 days.',
    ],
  },
  {
    heading: '4a. Price, VAT and cancelling (EU and UK consumers)',
    body: [
      'Prices are shown in US dollars. Where VAT or sales tax applies to your purchase it is added at checkout and displayed before you confirm payment, so the amount you agree to is the total you are charged. If you are a business in the EU with a valid VAT number you can enter it at checkout.',
      `If you are a consumer in the EU or UK you have a statutory right to withdraw from a purchase within 14 days, without giving a reason. To exercise it, email ${SUPPORT_EMAIL} within those 14 days; we will refund you to your original payment method within 14 days of your request.`,
      'One exception matters here. Digital content that you have already begun to use is not refundable: by starting a render you are asking us to begin supplying the service immediately, and you acknowledge that you lose the withdrawal right over credits you have already spent. Credits you have not spent remain refundable within the window.',
      'This sits alongside, and does not replace, the separate 14-day money-back guarantee on a first charge described in section 4, which is a contractual promise and applies regardless.',
      'Nothing in these terms reduces the rights the Consumer Rights Directive, or equivalent UK law, gives you.',
    ],
  },
  {
    heading: '4b. Who you are contracting with',
    body: [
      `The Service is provided by Rihla AB, a Swedish limited company (aktiebolag), registered in Sweden under company number 559589-5656, with its registered office (säte) in Sollentuna, Stockholm County, and its postal address at Mässvägen 13 A, lgh 1804, 191 61 Sollentuna, Sweden. You can contact us at ${SUPPORT_EMAIL} or by post at that address.`,
      'We are registered in the Swedish Companies Registration Office (Bolagsverket). Swedish and EU e-commerce law requires us to give you this identity, address and registration information before you buy, which is why it appears here and in our site footer.',
    ],
  },
  {
    heading: '5. Bring your own keys (BYOK)',
    body: [
      'You may connect your own provider API keys (for example Anthropic, ElevenLabs or Kling). When you do, you pay that provider directly under your own agreement with them, and Vidora charges only a small platform fee. We store your keys encrypted and use them solely to run renders you request. You are responsible for your provider account, its limits and its costs.',
    ],
  },
  {
    heading: '6. Your content',
    body: [
      'You keep ownership of the topics, scripts and other material you supply, and of the videos the Service produces for you. You grant us only the licence needed to operate the Service -- to process your inputs, call the providers, store the output and deliver it to the destinations you choose.',
      "You are responsible for the content you publish, including that it complies with YouTube's and any other platform's rules, and with any disclosure requirements for synthetic or AI-generated media.",
    ],
  },
  {
    heading: '6a. AI-generated content and your duty to disclose it',
    body: [
      'The videos the Service produces are generated or manipulated by AI, including the synthetic voice and, where you choose them, AI-generated visuals. That has a legal consequence for you as the publisher.',
      "Under the EU AI Act (Article 50) and the rules of the major platforms, content that is artificially generated or manipulated must be disclosed. YouTube, for instance, requires you to flag realistic synthetic content and to keep that flag accurate. Where your audience is in the EU you must make the disclosure clearly at the point people encounter the content - for a video that normally means the platform's synthetic-content flag, plus a note on screen or in the description where the content is realistic.",
      'You are the deployer and the publisher, so this obligation is yours. We help by recording how each video was produced, but we cannot make the disclosure for you and cannot judge whether a particular video is realistic enough to need one. Do not use the Service to present synthetic content as a genuine recording of real people, places or events.',
    ],
  },
  {
    heading: '7. Acceptable use',
    body: [
      "Do not use the Service to create or publish content that is unlawful, infringing, deceptive, harassing, or that sexualises minors; to impersonate a real person without consent; to generate misinformation; or to break any platform's terms. Do not attempt to bypass usage limits, resell the Service without agreement, or use it to build a competing dataset or model.",
      'We may suspend or terminate an account that breaches this section.',
    ],
  },
  {
    heading: '8. Third-party services',
    body: [
      'The Service depends on third parties (see our Privacy Policy for the current list). Their availability, pricing and policies are outside our control, and an outage or policy change on their side can interrupt or change what the Service can do.',
    ],
  },
  {
    heading: '9. Availability and changes',
    body: [
      'We aim to keep the Service available but do not promise uninterrupted service. We may change features, and may change these terms; material changes will be notified by email or in the app before they take effect.',
    ],
  },
  {
    heading: '10. Disclaimer',
    body: [
      'The Service is provided "as is". To the extent permitted by law we disclaim implied warranties, including fitness for a particular purpose. AI output can be inaccurate or unsuitable, and you are responsible for reviewing anything before you publish it.',
    ],
  },
  {
    heading: '11. Limitation of liability',
    body: [
      'To the extent permitted by law, our total liability arising from the Service is limited to the amount you paid us in the 12 months before the claim. We are not liable for indirect or consequential losses, including lost revenue, lost views, or content removed by a platform.',
    ],
  },
  {
    heading: '12. Termination',
    body: [
      'You can delete your account at any time from Settings, which removes your data as described in the Privacy Policy. We may suspend or terminate an account for breach of these terms or where required by law.',
    ],
  },
  {
    heading: '13. Governing law',
    body: [
      'These terms are governed by the laws of Sweden, and the Swedish courts have jurisdiction.',
      'If you are a consumer resident elsewhere, this does not remove the protection given to you by the mandatory consumer law of your country of residence, and you may bring proceedings in the courts of that country. Under EU rules (Rome I, Article 6) you keep that protection even though Swedish law governs the contract.',
      'The United Nations Convention on Contracts for the International Sale of Goods does not apply.',
    ],
  },
  {
    heading: '14. Contact',
    body: [
      `Questions about these terms: ${SUPPORT_EMAIL}.`,
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Terms of Service"
        description="The terms governing your use of Vidora, including credits, billing, content ownership and acceptable use."
        path="/terms"
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
            Terms of Service
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
