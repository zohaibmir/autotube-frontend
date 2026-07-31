import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration?: number // ms, default 4000
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void
  removeToast: (id: string) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 4000) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => {
        // Max 3 visible at once — drop oldest
        const next = prev.length >= 3 ? prev.slice(1) : prev
        return [...next, { id, message, variant, duration }]
      })
    },
    []
  )

  const success = useCallback((m: string, d?: number) => addToast(m, 'success', d), [addToast])
  const error   = useCallback((m: string, d?: number) => addToast(m, 'error',   d), [addToast])
  const warning = useCallback((m: string, d?: number) => addToast(m, 'warning', d), [addToast])
  const info    = useCallback((m: string, d?: number) => addToast(m, 'info',    d), [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastList toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// ─── Toast list (portal — bottom-right) ───────────────────────────────────────

function ToastList({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-[340px] pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

// ─── Individual toast ─────────────────────────────────────────────────────────

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={15} strokeWidth={1.5} className="text-[#16A34A]" />,
  error:   <AlertCircle  size={15} strokeWidth={1.5} className="text-[#DC2626]" />,
  warning: <AlertTriangle size={15} strokeWidth={1.5} className="text-[#D97706]" />,
  info:    <Info         size={15} strokeWidth={1.5} className="text-[#2563EB]" />,
}

const LEFT_BORDER: Record<ToastVariant, string> = {
  success: 'border-l-[3px] border-l-[#16A34A]',
  error:   'border-l-[3px] border-l-[#DC2626]',
  warning: 'border-l-[3px] border-l-[#D97706]',
  info:    'border-l-[3px] border-l-[#2563EB]',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fade in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Auto-dismiss
  useEffect(() => {
    const duration = toast.duration ?? 4000
    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(toast.id), 200)
    }, duration)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast.id, toast.duration, onRemove])

  const handleRemove = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
    setTimeout(() => onRemove(toast.id), 200)
  }

  return (
    <div
      role="alert"
      className={[
        'pointer-events-auto bg-white border border-[#E5E5E5] rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.10)]',
        'flex items-start gap-2.5 px-3.5 py-3 w-full',
        LEFT_BORDER[toast.variant],
        'transition-all duration-200',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      ].join(' ')}
    >
      <span className="mt-0.5 flex-shrink-0">{ICONS[toast.variant]}</span>
      <p className="flex-1 text-[13px] text-[#0A0A0A] leading-snug">{toast.message}</p>
      <button
        onClick={handleRemove}
        aria-label="Dismiss"
        className="flex-shrink-0 text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors mt-0.5"
      >
        <X size={13} strokeWidth={1.5} />
      </button>
    </div>
  )
}
