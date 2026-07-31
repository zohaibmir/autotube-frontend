import React from 'react'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'

const values = [
  { title: 'Honesty first', description: 'We tell you what the AI can and cannot do. No overpromising, no dark patterns. What you see is what you get.' },
  { title: 'Creator-centric', description: "Every decision starts with one question: does this save creators meaningful time? If not, we don't build it." },
  { title: 'Quality over quantity', description: "Automated doesn't mean low quality. We invest heavily in output quality so your audience can't tell the difference." },
  { title: 'Radical transparency', description: 'Your dashboard shows every step of the pipeline. No black boxes. You always know what is happening with your content.' },
]

const team = [
  { name: 'Alex Chen', role: 'Co-founder & CEO', bio: 'Former YouTube creator with 2M subscribers. Built this because he needed it.' },
  { name: "Niamh O'Brien", role: 'Co-founder & CTO', bio: 'Ex-Google engineer, specialising in large-scale video processing pipelines.' },
  { name: 'Omar Hassan', role: 'Head of AI', bio: 'PhD in NLP. Previously led content generation at a major media company.' },
  { name: 'Yuki Tanaka', role: 'Head of Design', bio: 'Designed interfaces used by millions at Notion and Linear before joining us.' },
]

const stats = [
  { value: '12,000+', label: 'videos published' },
  { value: '800+', label: 'active creators' },
  { value: '30+', label: 'languages supported' },
  { value: '4.8 / 5', label: 'average rating' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-20 px-6 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-sky-500 font-semibold text-sm uppercase tracking-widest mb-5">About us</p>
          <h1 className="text-5xl font-bold text-navy-600 leading-[1.1] mb-5">
            Built by creators,<br />for creators.
          </h1>
          <p className="text-xl text-gray-500 leading-relaxed max-w-xl">
            We built YouTube Automation because creating great content should be about ideas — not tedious production work.
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-12 px-6 border-b border-gray-100">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-navy-600 mb-1">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-navy-600 mb-6">Our mission</h2>
          <p className="text-gray-500 leading-relaxed text-lg mb-4">
            Every creator has ideas worth sharing. Most of them are blocked not by a lack of creativity — but by the sheer time it takes to produce, edit, and publish consistently.
          </p>
          <p className="text-gray-500 leading-relaxed text-lg">
            Our mission is to make that problem disappear, so that publishing daily feels as natural as writing a tweet.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-navy-600 mb-12">What we believe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {values.map((v) => (
              <div key={v.title}>
                <h3 className="font-semibold text-navy-600 mb-2">{v.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-navy-600 mb-12">The team</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {team.map((member) => (
              <div key={member.name} className="card">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {member.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-navy-600 text-sm">{member.name}</p>
                    <p className="text-xs text-gray-400">{member.role}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
