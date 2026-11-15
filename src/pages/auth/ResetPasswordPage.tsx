import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader, CheckCircle2, AlertTriangle } from 'lucide-react'
import Logo from '@components/Logo'
import { useAuthStore } from '@store/auth'

/**
 * Read the recovery token Supabase put in the emailed link.
 *
 * The default `recover` redirect carries it in the URL fragment
 * (`/reset-password#access_token=...&type=recovery`); some project settings put
 * it in the query string instead, so accept both.
 */
function readRecoveryToken(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const token = (hash.get('access_token') || query.get('access_token') || '').trim()
  return token || null
}

/**
 * Step 2 of password recovery: set a new password using the emailed token.
 *
 * Takes no user id -- the token IS the proof of identity, and the backend
 * validates it against Supabase. A visitor without a valid token cannot use
 * this page to change anyone's password.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const resetPassword = useAuthStore((s) => s.resetPassword)

  // Read once on mount: the token is in the URL, not in state we control.
  const token = useMemo(readRecoveryToken, [])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  // Strip the token from the address bar so it does not linger in browser
  // history or end up in a screenshot.
  useEffect(() => {
    if (token && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) return
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Those passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail
                                           : 'That link is no longer valid. Request a new one.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <header className="px-8 py-5 flex items-center justify-between border-b border-[#E5E5E5] bg-white">
        <Link to="/" aria-label="Vidora home" className="flex items-center">
          <Logo size={24} wordmarkSize={15} />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {!token ? (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#FFFBEB] border border-[#FEF08A] flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} strokeWidth={1.5} className="text-[#D97706]" />
                </div>
                <h1 className="text-xl font-semibold text-[#0A0A0A] tracking-tight">Link not valid</h1>
              </div>
              <p className="text-sm text-[#525252] leading-relaxed mb-6">
                This reset link is missing its token, or it has already been used. Reset links
                expire after an hour and can only be used once.
              </p>
              <Link to="/forgot-password" className="text-sm text-[#0A0A0A] font-medium hover:underline">
                Request a new link →
              </Link>
            </>
          ) : done ? (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={16} strokeWidth={1.5} className="text-[#16A34A]" />
                </div>
                <h1 className="text-xl font-semibold text-[#0A0A0A] tracking-tight">Password updated</h1>
              </div>
              <p className="text-sm text-[#525252] leading-relaxed mb-6">
                You can now sign in with your new password. Taking you there…
              </p>
              <Link to="/login" className="text-sm text-[#0A0A0A] font-medium hover:underline">
                Sign in →
              </Link>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-[#0A0A0A] tracking-tight">Set a new password</h1>
                <p className="text-sm text-[#A3A3A3] mt-1">At least 8 characters.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div role="alert" className="bg-[#FFF1F2] border border-[#FECDD3] rounded-md px-4 py-3 text-sm text-[#BE123C]">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    autoFocus
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-10 px-3 text-sm text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirm-password" className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full h-10 px-3 text-sm text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 flex items-center justify-center gap-2 bg-[#0A0A0A] text-white text-sm font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
                >
                  {loading && <Loader size={14} strokeWidth={1.5} className="animate-spin" />}
                  Update password
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
