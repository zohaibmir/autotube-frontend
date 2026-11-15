import React, { useState } from 'react'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import apiClient from '@api/client'
import { Check } from 'lucide-react'
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@lib/site'

const contacts = [
  { label: 'Email', value: SUPPORT_EMAIL, note: 'We read every message' },
  { label: 'Response time (Free)', value: 'Within 48 hours', note: '' },
  { label: 'Response time (Pro)', value: 'Within 24 hours', note: '' },
  { label: 'Response time (Agency)', value: 'Within 4 hours', note: 'Onboarding for your team' },
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Whether the backend actually emailed support. When SMTP is not configured
  // the message is still stored, but we must not promise a reply window that
  // nothing is watching for.
  const [emailed, setEmailed] = useState(false)

  // Posts to the real /api/contact endpoint, which stores the message and
  // notifies support. This previously did `await new Promise(r => setTimeout(r,
  // 800))` and then claimed the message had been sent -- nothing was ever
  // delivered, so a billing complaint or a data request disappeared silently.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await apiClient.post('/api/contact', form)
      setEmailed(Boolean(data?.emailed))
      setSubmitted(true)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : `We could not send your message. Please email ${SUPPORT_EMAIL} directly.`,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Contact"
        description="Contact the Vidora team with product questions, feedback or a bug report. Include the details needed to investigate your request."
        path="/contact"
      />

      {/* Hero */}
      <main className="flex flex-1 flex-col">
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 56 }}>
          <p className="font-semibold uppercase text-sky-700" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}>
            Contact
          </p>
          <h1
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(2.25rem, 4.6vw, 3.25rem)', lineHeight: 1.06, letterSpacing: '-0.03em' }}
          >
            Get in touch.
          </h1>
          <p className="text-gray-500" style={{ fontSize: 18, lineHeight: 1.65, marginTop: 18, maxWidth: 620 }}>
            Questions, feedback, or a bug report? We respond to every message.
          </p>
        </div>
      </section>

      {/* Two-column */}
      <section className="border-b border-gray-100">
        <div
          className="site-container grid grid-cols-1 md:grid-cols-3"
          style={{ paddingTop: 56, paddingBottom: 72, gap: 40 }}
        >

          {/* Info column */}
          <div style={{ display: 'grid', gap: 24, alignContent: 'start' }}>
            {contacts.map((c) => (
              <div key={c.label}>
                <p
                  className="font-semibold uppercase text-gray-500"
                  style={{ fontSize: 11, letterSpacing: '0.09em', marginBottom: 5 }}
                >
                  {c.label}
                </p>
                <p className="font-semibold text-navy-600" style={{ fontSize: 15 }}>{c.value}</p>
                {c.note && <p className="text-gray-500" style={{ fontSize: 12.5, marginTop: 3 }}>{c.note}</p>}
              </div>
            ))}
          </div>

          {/* Form, in a panel so the page has a clear focal point. The field
              styling itself is left to .field-input/.field-label, which the
              dashboard and auth pages share. */}
          <div className="md:col-span-2 rounded-[14px] border border-gray-200 bg-white" style={{ padding: 28 }}>
            {submitted ? (
              <div className="rounded-[14px] border border-gray-200 text-center" style={{ padding: 40 }}>
                <div
                  className="flex items-center justify-center rounded-full bg-green-50 text-green-500"
                  style={{ width: 48, height: 48, marginInline: 'auto', marginBottom: 20 }}
                >
                  <Check size={22} />
                </div>
                <h2 className="font-bold text-navy-600" style={{ fontSize: 20, marginBottom: 8 }}>Message sent</h2>
                {emailed ? (
                  <p className="text-gray-500 text-sm">We will get back to you within 24 hours.</p>
                ) : (
                  <p className="text-gray-500 text-sm">
                    We have recorded your message. For a faster reply, email{' '}
                    <a href={SUPPORT_MAILTO} className="underline hover:text-navy-600">
                      {SUPPORT_EMAIL}
                    </a>{' '}
                    directly.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div role="alert" className="bg-[#FFF1F2] border border-[#FECDD3] rounded-md px-4 py-3 text-sm text-[#BE123C]">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="field-label" htmlFor="name">Name</label>
                    <input id="name" type="text" required value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="field-input" placeholder="Your name" />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="email">Email</label>
                    <input id="email" type="email" required value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="field-input" placeholder="you@example.com" />
                  </div>
                </div>
                <div>
                  <label className="field-label" htmlFor="subject">Subject</label>
                  <input id="subject" type="text" required value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="field-input" placeholder="How can we help?" />
                </div>
                <div>
                  <label className="field-label" htmlFor="message">Message</label>
                  <textarea id="message" rows={6} required value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="field-input resize-none" placeholder="Describe your question or issue..." />
                </div>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Sending…' : 'Send message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  )
}
