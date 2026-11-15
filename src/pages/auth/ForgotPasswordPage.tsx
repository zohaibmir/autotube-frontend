import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader, MailCheck } from 'lucide-react'
import Logo from '@components/Logo'
import { useAuthStore } from '@store/auth'

/**
 * Step 1 of password recovery.
 *
 * The success state is shown for ANY address, including one with no account.
 * That is deliberate: the backend always reports success too, so neither the
 * API nor this page can be used to discover which emails are registered.
 */
export default function ForgotPasswordPage() {
  const forgotPassword = useAuthStore((s) => s.forgotPassword)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email.trim())
    } catch {
      // Swallowed on purpose -- see the doc comment above. A network failure is
      // indistinguishable from an unknown address, by design.
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <header className="px-8 py-5 flex items-center justify-between border-b border-[#E5E5E5] bg-white">
        <Link to="/" aria-label="Vidora home" className="flex items-center">
          <Logo size={24} wordmarkSize={15} />
        </Link>
        <p className="text-sm text-[#A3A3A3]">
          Remembered it?{' '}
          <Link to="/login" className="text-[#0A0A0A] font-medium hover:underline">Sign in</Link>
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {sent ? (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center flex-shrink-0">
                  <MailCheck size={16} strokeWidth={1.5} className="text-[#16A34A]" />
                </div>
                <h1 className="text-xl font-semibold text-[#0A0A0A] tracking-tight">Check your email</h1>
              </div>
              <p className="text-sm text-[#525252] leading-relaxed mb-2">
                If <span className="font-medium text-[#0A0A0A]">{email}</span> has an account, we have
                sent a link to reset the password.
              </p>
              <p className="text-sm text-[#A3A3A3] leading-relaxed mb-6">
                The link expires in an hour. Check your spam folder if it has not arrived in a few
                minutes.
              </p>
              <Link to="/login" className="text-sm text-[#0A0A0A] font-medium hover:underline">
                ← Back to sign in
              </Link>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-[#0A0A0A] tracking-tight">Reset your password</h1>
                <p className="text-sm text-[#A3A3A3] mt-1">
                  Enter your email and we will send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="forgot-email" className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">
                    Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-10 px-3 text-sm text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md placeholder:text-[#D4D4D4] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 flex items-center justify-center gap-2 bg-[#0A0A0A] text-white text-sm font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
                >
                  {loading && <Loader size={14} strokeWidth={1.5} className="animate-spin" />}
                  Send reset link
                </button>
              </form>

              <p className="text-sm text-[#A3A3A3] mt-6">
                <Link to="/login" className="text-[#0A0A0A] font-medium hover:underline">
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
