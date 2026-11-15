import { Check, Loader2, CircleDashed, Play } from 'lucide-react'

/**
 * A code-drawn product preview for the hero.
 *
 * The hero was text-only, which is the main reason the page read as unfinished:
 * every reference in the space (Linear, Mentimeter, Epidemic Sound) shows the
 * product itself above the fold rather than describing it. Drawn with divs
 * instead of a screenshot so it stays sharp, themeable and honest — it mirrors
 * the real pipeline stages the product runs, and needs no asset pipeline.
 *
 * Sizing is explicit (inline px / arbitrary values) because tailwind.config.js
 * doubles spacing keys 0-16.
 */

const STAGES = [
  { label: 'Script', detail: 'Claude · 1,284 words', state: 'done' },
  { label: 'Voiceover', detail: 'Edge TTS · 4m 12s', state: 'done' },
  { label: 'Visuals', detail: '12 of 19 clips', state: 'running' },
  { label: 'Music bed', detail: 'Royalty-free · mixed', state: 'done' },
  { label: 'Thumbnail', detail: 'Generated + scored', state: 'done' },
  { label: 'Upload', detail: 'Queued · 18:00 UTC', state: 'queued' },
] as const

function StateIcon({ state }: { state: (typeof STAGES)[number]['state'] }) {
  if (state === 'done') {
    return (
      <span className="inline-flex items-center justify-center rounded-full" style={{ width: 18, height: 18, backgroundColor: '#EAF6EF' }}>
        <Check size={11} strokeWidth={3} color="#267361" />
      </span>
    )
  }
  if (state === 'running') {
    return (
      <span className="inline-flex items-center justify-center rounded-full" style={{ width: 18, height: 18, backgroundColor: '#F0F4F8' }}>
        <Loader2 size={11} strokeWidth={3} color="#1A3A52" className="animate-spin" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center rounded-full" style={{ width: 18, height: 18, backgroundColor: '#F5F5F5' }}>
      <CircleDashed size={11} strokeWidth={3} color="#A3A3A3" />
    </span>
  )
}

export default function PipelinePreview() {
  return (
    <div
      className="w-full overflow-hidden rounded-[14px] border border-gray-200 bg-white"
      style={{ boxShadow: '0 1px 3px rgba(26,58,82,0.06), 0 12px 32px -12px rgba(26,58,82,0.14)' }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-[10px] border-b border-gray-100 bg-[#FAFBFC]" style={{ padding: '10px 14px' }}>
        <span className="flex" style={{ gap: 6 }}>
          <span className="rounded-full bg-gray-200" style={{ width: 9, height: 9 }} />
          <span className="rounded-full bg-gray-200" style={{ width: 9, height: 9 }} />
          <span className="rounded-full bg-gray-200" style={{ width: 9, height: 9 }} />
        </span>
        <span className="font-medium text-gray-500" style={{ fontSize: 12 }}>Vidora · Pipeline</span>
        <span className="ml-auto inline-flex items-center gap-[5px] rounded-md bg-white text-gray-500 border border-gray-200" style={{ padding: '2px 7px', fontSize: 11 }}>
          <Play size={9} strokeWidth={2.5} /> Running
        </span>
      </div>

      <div className="flex">
        {/* Topic pane */}
        <div className="hidden sm:block border-r border-gray-100" style={{ width: 168, padding: '14px 14px' }}>
          <p className="font-semibold uppercase text-gray-500" style={{ fontSize: 10, letterSpacing: '0.08em' }}>Topic</p>
          <p className="font-medium text-navy-600" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
            Why the ocean is getting warmer
          </p>
          <div className="border-t border-gray-100" style={{ marginTop: 14, paddingTop: 12 }}>
            <p className="font-semibold uppercase text-gray-500" style={{ fontSize: 10, letterSpacing: '0.08em' }}>Credits</p>
            <p className="font-semibold text-navy-600" style={{ fontSize: 13, marginTop: 5 }}>40 available</p>
          </div>
        </div>

        {/* Stage list */}
        <div className="flex-1" style={{ padding: '8px 6px' }}>
          {STAGES.map((stage, i) => (
            <div
              key={stage.label}
              className="flex items-center rounded-[8px]"
              style={{ gap: 10, padding: '9px 10px', backgroundColor: stage.state === 'running' ? '#F8FAFC' : 'transparent' }}
            >
              <span className="text-gray-500 tabular-nums" style={{ fontSize: 11, width: 16 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <StateIcon state={stage.state} />
              <span className="font-medium text-navy-600" style={{ fontSize: 13 }}>{stage.label}</span>
              <span className="ml-auto text-gray-500 text-right" style={{ fontSize: 11 }}>{stage.detail}</span>
            </div>
          ))}

          {/* Progress */}
          <div style={{ margin: '8px 10px 6px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <span className="text-gray-500" style={{ fontSize: 11 }}>Rendering</span>
              <span className="font-medium text-navy-600" style={{ fontSize: 11 }}>62%</span>
            </div>
            <div className="rounded-full bg-gray-100 overflow-hidden" style={{ height: 5 }}>
              <div className="h-full rounded-full" style={{ width: '62%', backgroundColor: '#1A3A52' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
