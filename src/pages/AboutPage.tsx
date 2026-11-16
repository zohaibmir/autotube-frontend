import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { ArrowRight } from 'lucide-react'

const values = [
  { title: 'Honesty first', description: 'We tell you what the AI can and cannot do. No overpromising, no dark patterns. What you see is what you get.' },
  { title: 'Creator-centric', description: "Every decision starts with one question: does this save creators meaningful time? If not, we don't build it." },
  { title: 'Quality over quantity', description: "Automated doesn't mean low quality. We invest heavily in output quality so your audience can't tell the difference." },
  { title: 'Radical transparency', description: 'Your dashboard shows every step of the pipeline. No black boxes. You always know what is happening with your content.' },
]

// Honest, checkable statements only. This block previously carried invented
// traction numbers -- "12,000+ videos published", "800+ active creators",
// "30+ languages", "4.8/5 average rating" -- on a product that had not launched.
// Those were unverifiable claims about a business with a handful of accounts,
// and fabricated testimonials/traction are exactly what the FTC's fake-review
// rule targets. Each line below describes behaviour you can check by using the
// product.
const facts = [
  { value: 'One topic', label: 'becomes a finished, publishable video' },
  { value: 'Exact cost', label: 'shown before every render — and that is what you pay' },
  { value: 'BYOK', label: 'bring your own API keys on any paid plan, including Own Keys' },
  { value: 'Every step', label: 'visible in your dashboard — no black box' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="About"
        description="Why we built Vidora: creating great content should be about ideas, not tedious production work. Our mission, values, and team."
        path="/about"
      />

      {/* Hero */}
      <main className="flex flex-1 flex-col">
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 56 }}>
          <p className="font-semibold uppercase text-sky-700" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}>
            About us
          </p>
          <h1
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(2.25rem, 4.6vw, 3.25rem)', lineHeight: 1.06, letterSpacing: '-0.03em', maxWidth: 760 }}
          >
            Built by creators,
            <br />
            for creators.
          </h1>
          <p className="text-gray-500" style={{ fontSize: 18.5, lineHeight: 1.65, marginTop: 18, maxWidth: 620 }}>
            We built Vidora because creating great content should be about ideas — not tedious
            production work.
          </p>
        </div>
      </section>

      {/* Facts. Statements about behaviour you can check by using the product,
          not traction numbers: this block previously carried invented figures
          ("12,000+ videos published", "800+ active creators", "4.8/5 average
          rating") on a product that had not launched. */}
      <section className="border-b border-gray-100 bg-[#FAFBFC]">
        <div
          className="site-container grid grid-cols-2 lg:grid-cols-4"
          style={{ paddingTop: 40, paddingBottom: 40, gap: 28 }}
        >
          {facts.map((s) => (
            <div key={s.label}>
              <p className="font-bold text-navy-600" style={{ fontSize: 20, lineHeight: 1.2, marginBottom: 6 }}>
                {s.value}
              </p>
              <p className="text-gray-500" style={{ fontSize: 13.5, lineHeight: 1.55 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 72 }}>
          <h2
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(1.5rem, 2.6vw, 1.9rem)', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 20 }}
          >
            Our mission
          </h2>
          <div style={{ maxWidth: 720 }}>
            <p className="text-gray-500" style={{ fontSize: 17, lineHeight: 1.75, marginBottom: 16 }}>
              Every creator has ideas worth sharing. Most of them are blocked not by a lack of
              creativity — but by the sheer time it takes to produce, edit, and publish consistently.
            </p>
            <p className="text-gray-500" style={{ fontSize: 17, lineHeight: 1.75 }}>
              Our mission is to make that problem disappear, so that publishing consistently feels as
              natural as writing a note, not a weekend project.
            </p>
          </div>

          {/* Promoted from a bare `border-l-2` paragraph to a figure. The quote is
              our own statement, so it carries our attribution rather than an
              invented customer's. */}
          <figure
            className="rounded-[14px] border border-gray-200 bg-[#FAFBFC]"
            style={{ marginTop: 32, padding: 26, maxWidth: 780 }}
          >
            <blockquote className="text-navy-600" style={{ fontSize: 16.5, lineHeight: 1.75, fontStyle: 'italic' }}>
              &ldquo;We started this because our own channel was dying under the production workload —
              not the algorithm. Editing, voiceover, thumbnails, uploads: two full days a week, every
              week. Vidora is the tool we wished existed back then, built so the next creator does not
              have to choose between having a life and having a channel.&rdquo;
            </blockquote>
            <figcaption className="text-gray-500" style={{ fontSize: 13, marginTop: 14 }}>
              — The Vidora team
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Values */}
      <section className="border-b border-gray-100 bg-[#FAFBFC]">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 72 }}>
          <h2
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(1.5rem, 2.6vw, 1.9rem)', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 32 }}
          >
            What we believe
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 18 }}>
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-[14px] border border-gray-200 bg-white"
                style={{ padding: 24 }}
              >
                <h3 className="font-semibold text-navy-600" style={{ fontSize: 16.5, marginBottom: 8 }}>{v.title}</h3>
                <p className="text-gray-500" style={{ fontSize: 14.5, lineHeight: 1.7 }}>{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who we are. This section previously listed four invented team members
          with fabricated credentials (an ex-Google CTO, a PhD in NLP, a designer
          from Notion and Linear). Replaced with something true until there are
          real people worth naming. */}
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 72 }}>
          <h2
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(1.5rem, 2.6vw, 1.9rem)', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 20 }}
          >
            Who we are
          </h2>
          <div style={{ maxWidth: 720 }}>
            <p className="text-gray-500" style={{ fontSize: 17, lineHeight: 1.75, marginBottom: 16 }}>
              Vidora is built by a small team of creators and engineers, and we are early. We would
              rather say that plainly than pad this page with numbers and names we cannot back up.
            </p>
            <p className="text-gray-500" style={{ fontSize: 17, lineHeight: 1.75 }}>
              What we offer instead is transparency you can verify by using the product: every render
              shows its exact cost before it runs, every pipeline step is visible in your dashboard,
              and you can bring your own API keys so you are never paying our markup on top of a
              provider you already fund.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy-600">
        <div className="site-container text-center" style={{ paddingTop: 68, paddingBottom: 68 }}>
          <h2
            className="font-bold text-white"
            style={{ fontSize: 'clamp(1.6rem, 2.8vw, 2.05rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}
          >
            See it for yourself.
          </h2>
          <p className="text-sky-200" style={{ fontSize: 16.5, lineHeight: 1.6, marginTop: 12 }}>
            The transparency claims on this page are all checkable from inside the product.
          </p>
          <div className="flex flex-col sm:flex-row justify-center" style={{ gap: 12, marginTop: 24 }}>
            <Link to="/signup" className="btn-primary btn-lg btn-inverse">
              Start free <ArrowRight size={17} />
            </Link>
            <Link to="/how-it-works" className="btn-secondary btn-lg btn-outline-inverse">
              See how it works
            </Link>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  )
}
