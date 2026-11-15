import { useSearchParams } from 'react-router-dom'
import StudioLibrary from '@components/studio/StudioLibrary'
import StudioToolsPage from './StudioPage'

type Tab = 'content' | 'tools'

/**
 * `/app/studio` — the Creator Studio shell.
 *
 * Content (the creator's library) is the default, per the plan: the library is the app, tools are
 * actions on it. The previous Studio page is kept intact as the Tools tab so every existing flow
 * (server renders, extract clips, import & clip, upload to YouTube) stays reachable during the
 * migration — nothing is removed before its replacement has parity.
 *
 * The tab lives in the URL (`?tab=tools`) so the old page is still linkable and the existing e2e
 * spec keeps testing it.
 */
export default function StudioWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: Tab = searchParams.get('tab') === 'tools' ? 'tools' : 'content'

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'content') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params)
  }

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      <div className="flex items-center gap-6 border-b border-[#E5E5E5] bg-white px-6">
        {(
          [
            ['content', 'Content'],
            ['tools', 'Tools'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              'py-3 text-[13px] font-medium transition-colors',
              tab === id
                ? 'border-b-2 border-[#0A0A0A] text-[#0A0A0A]'
                : 'border-b-2 border-transparent text-[#A3A3A3] hover:text-[#525252]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'content' ? (
          <StudioLibrary onOpenTools={() => setTab('tools')} />
        ) : (
          <StudioToolsPage />
        )}
      </div>
    </div>
  )
}
