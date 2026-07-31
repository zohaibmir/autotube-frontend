import React from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useCreateStore, type CreateStep } from '@store/create'

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS: { id: CreateStep; label: string; path: string }[] = [
  { id: 1, label: 'Ideas',     path: '/app/create/ideas'     },
  { id: 2, label: 'Script',    path: '/app/create/script'    },
  { id: 3, label: 'SEO',       path: '/app/create/seo'       },
  { id: 4, label: 'Thumbnail', path: '/app/create/thumbnail' },
  { id: 5, label: 'Submit',    path: '/app/create/submit'    },
]

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper() {
  const step = useCreateStore((s) => s.step)

  return (
    <nav className="flex items-center gap-0" aria-label="Create steps">
      {STEPS.map((s, i) => {
        const done   = s.id < step
        const active = s.id === step

        return (
          <React.Fragment key={s.id}>
            {i > 0 && (
              <span className="w-6 h-px bg-[#E5E5E5] mx-1 flex-shrink-0" />
            )}
            <div
              className={[
                'pb-0.5 text-[12px] transition-colors select-none whitespace-nowrap border-b',
                active
                  ? 'border-[#0A0A0A] text-[#0A0A0A] font-semibold'
                  : done
                  ? 'border-transparent text-[#A3A3A3] cursor-default'
                  : 'border-transparent text-[#D4D4D4] cursor-default',
              ].join(' ')}
              aria-current={active ? 'step' : undefined}
            >
              {s.label}
            </div>
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function CreateLayout() {
  const navigate  = useNavigate()
  const { step, reset } = useCreateStore()

  const handleBack = () => {
    if (step <= 1) {
      navigate('/app')
    } else {
      const prev = STEPS.find((s) => s.id === step - 1)
      if (prev) navigate(prev.path)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <div className="h-12 flex-shrink-0 flex items-center justify-between px-6 border-b border-[#E5E5E5] bg-white">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-[12px] text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.5} />
          {step <= 1 ? 'Dashboard' : STEPS.find((s) => s.id === step - 1)?.label}
        </button>

        <Stepper />

        <button
          onClick={() => { reset(); navigate('/app/create/ideas') }}
          className="text-[11px] text-[#A3A3A3] hover:text-[#DC2626] transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto bg-[#FAFAFA]">
        <Outlet />
      </div>
    </div>
  )
}
