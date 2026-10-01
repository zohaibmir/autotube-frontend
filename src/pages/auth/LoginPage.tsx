import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Loader, Zap } from 'lucide-react'
import { useAuthStore } from '@store/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/app/dashboard'
  const login = useAuthStore((s) => s.login)
  const isLoading = useAuthStore((s) => s.isLoading)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err: any) {
      // Prefer the backend's actual error detail; never show the raw axios
      // message ("Request failed with status code 401") to the user.
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Incorrect email or password.')
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
          No account?{' '}
          <Link to="/signup" className="text-[#0A0A0A] font-medium hover:underline">Sign up free</Link>
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#0A0A0A] tracking-tight">Sign in</h1>
            <p className="text-sm text-[#A3A3A3] mt-1">Welcome back.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="bg-[#FFF1F2] border border-[#FECDD3] rounded-md px-4 py-3 text-sm text-[#BE123C]">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">Email</label>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 text-sm text-[#0A0A0A] placeholder-[#D4D4D4] focus:outline-none focus:border-[#0A0A0A] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">Password</label>
                <Link to="/forgot-password" className="text-xs text-[#A3A3A3] hover:text-[#525252]">Forgot?</Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
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
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full bg-[#0A0A0A] hover:bg-[#262626] disabled:bg-[#D4D4D4] text-white font-medium text-sm py-2.5 rounded-md flex items-center justify-center gap-2 transition-colors mt-2"
            >
              {isLoading ? (
                <><Loader size={14} strokeWidth={1.5} className="animate-spin" /> Signing in...</>
              ) : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
