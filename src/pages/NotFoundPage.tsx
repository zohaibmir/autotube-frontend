import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO title="Page not found" description="This page does not exist. Explore Vidora or return to the blog." noIndex />
      <main className="site-container flex-1" style={{ paddingTop: 72, paddingBottom: 72 }}>
        <h1 className="font-bold text-navy-600" style={{ fontSize: 36 }}>Page not found</h1>
        <p className="text-gray-500" style={{ marginTop: 16, marginBottom: 24 }}>
          The link may be incorrect, or the page may have moved.
        </p>
        <Link to="/" className="btn-primary">Return home</Link>
      </main>
      <Footer />
    </div>
  )
}
