import React, { useState } from 'react'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { Check } from 'lucide-react'

const contacts = [
  { label: 'Email', value: 'support@channelpilot.io', note: 'We read every message' },
  { label: 'Response time (Free)', value: 'Within 48 hours', note: '' },
  { label: 'Response time (Pro)', value: 'Within 24 hours', note: '' },
  { label: 'Response time (Enterprise)', value: 'Within 4 hours', note: 'Dedicated account manager' },
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Contact"
        description="Questions, feedback, or a bug report? Reach the Channelpilot team - we respond to every message, with tiered response times by plan."
        path="/contact"
      />

      {/* Hero */}
      <section className="pt-28 pb-20 px-6 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-sky-500 font-semibold text-sm uppercase tracking-widest mb-5">Contact</p>
          <h1 className="text-5xl font-bold text-navy-600 leading-[1.1] mb-5">Get in touch</h1>
          <p className="text-xl text-gray-500 max-w-xl">
            Questions, feedback, or a bug report? We respond to every message.
          </p>
        </div>
      </section>

      {/* Two-column */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16">

          {/* Info column */}
          <div className="space-y-8">
            {contacts.map((c) => (
              <div key={c.label}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{c.label}</p>
                <p className="font-semibold text-navy-600 text-sm">{c.value}</p>
                {c.note && <p className="text-xs text-gray-400 mt-0.5">{c.note}</p>}
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="md:col-span-2">
            {submitted ? (
              <div className="border border-gray-200 rounded-xl p-12 text-center">
                <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Check size={22} />
                </div>
                <h3 className="text-xl font-bold text-navy-600 mb-2">Message sent</h3>
                <p className="text-gray-500 text-sm">We will get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
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

      <Footer />
    </div>
  )
}
