import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader, CheckCircle2, Zap } from 'lucide-react'
import { useAuthStore } from '@store/auth'

export default function SignupPage() {
  const navigate = useNavigate()
  const signup = useAuthStore((s) => s.signup)
  const isLoading = useAuthStore((s) => s.isLoading)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [confirmEmail, setConfirmEmail] = useState(false)

  const strength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'][strength]
  const strengthColor = ['', 'bg-[#DC2626]', 'bg-[#D97706]', 'bg-[#16A34A]'][strength]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    try {
      const result = await signup(email.trim(), password, name.trim() || undefined)
      if (result.confirmEmail) {
        setConfirmEmail(true)
      } else {
        navigate('/app/dashboard', { replace: true })
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Sign up failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <header className="px-8 py-5 flex items-center justify-between border-b border-[#E5E5E5] bg-white">
        <Link to="/" className="flex items-center gap-2 text-[#0A0A0A] font-semibold text-sm">
          <div className="w-6 h-6 bg-[#0A0A0A] rounded-md flex items-center justify-center">
            <Zap size={12} strokeWidth={2} className="text-white" />
          </div>
          Channelpilot
        </Link>
        <p className="text-sm text-[#A3A3A3]">
          Have an account?{' '}
          <Link to="/login" className="text-[#0A0A0A] font-medium hover:underline">Sign in</Link>
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {confirmEmail ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-[#F0FDF4] rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={22} strokeWidth={1.5} className="text-[#16A34A]" />
              </div>
              <h2 className="text-xl font-semibold text-[#0A0A0A] mb-2">Check your email</h2>
              <p className="text-sm text-[#525252] mb-2">We sent a confirmation link to</p>
              <p className="text-sm font-medium text-[#0A0A0A] mb-6">{email}</p>
              <p className="text-xs text-[#A3A3A3] mb-8">
                Click the link to activate your account, then sign in.
              </p>
              <Link
                to="/login"
                className="bg-[#0A0A0A] hover:bg-[#262626] text-white px-6 py-2.5 rounded-md text-sm font-medium transition-colors"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-[#0A0A0A] tracking-tight">Create account</h1>
                <p className="text-sm text-[#A3A3A3] mt-1">Start for free. No credit card required.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div role="alert" className="bg-[#FFF1F2] border border-[#FECDD3] rounded-md px-4 py-3 text-sm text-[#BE123C]">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">
                    Name <span className="normal-case tracking-normal font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 text-sm text-[#0A0A0A] placeholder-[#D4D4D4] focus:outline-none focus:border-[#0A0A0A] transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 text-sm text-[#0A0A0A] placeholder-[#D4D4D4] focus:outline-none focus:border-[#0A0A0A] transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 text-sm text-[#0A0A0A] placeholder-[#D4D4D4] focus:outline-none focus:border-[#0A0A0A] transition-colors pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#525252]"
                    >
                      {showPass ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= strength ? strengthColor : 'bg-[#E5E5E5]'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-[#A3A3A3] w-10">{strengthLabel}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  className="w-full bg-[#0A0A0A] hover:bg-[#262626] disabled:bg-[#D4D4D4] text-white font-medium text-sm py-2.5 rounded-md flex items-center justify-center gap-2 transition-colors mt-2"
                >
                  {isLoading ? (
                    <><Loader size={14} strokeWidth={1.5} className="animate-spin" /> Creating account...</>
                  ) : 'Create free account'}
                </button>

                <p className="text-xs text-[#A3A3A3] text-center">
                  By signing up you agree to our{' '}
                  <Link to="/terms" className="underline hover:text-[#525252]">Terms</Link>{' '}and{' '}
                  <Link to="/privacy" className="underline hover:text-[#525252]">Privacy Policy</Link>.
                </p>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
