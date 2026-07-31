import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentType = 'longform' | 'short' | 'kids'
export type CreateStep  = 1 | 2 | 3 | 4 | 5

export interface TopicIdea {
  id: string
  topic: string
  score: number
  type: 'viral' | 'evergreen' | 'news' | 'custom'
  angle: string
  hook: string
  thumbnailText: string
  shortsAngle: string
  cpmEstimate: string
  competition: 'low' | 'medium' | 'high'
}

export interface SeoPackage {
  titles: string[]           // A/B options, first is selected
  selectedTitle: string
  description: string
  tags: string[]
  uploadTimingHint: string
  chapters: { time: string; label: string }[]
}

export interface CreateState {
  step: CreateStep
  channelSlug: string
  contentType: ContentType
  selectedTopic: TopicIdea | null
  scriptContent: string
  retentionScore: number | null
  seoPackage: SeoPackage | null
  thumbnailData: Record<string, unknown> | null

  // Actions
  setStep: (step: CreateStep) => void
  setChannel: (slug: string) => void
  setContentType: (type: ContentType) => void
  selectTopic: (topic: TopicIdea) => void
  setScript: (content: string) => void
  setRetentionScore: (score: number) => void
  setSeoPackage: (pkg: SeoPackage) => void
  setThumbnailData: (data: Record<string, unknown>) => void
  reset: () => void
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: Omit<CreateState, keyof { [K in keyof CreateState as CreateState[K] extends Function ? K : never]: never }> = {
  step:             1,
  channelSlug:      '',
  contentType:      'longform',
  selectedTopic:    null,
  scriptContent:    '',
  retentionScore:   null,
  seoPackage:       null,
  thumbnailData:    null,
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCreateStore = create<CreateState>()(
  persist(
    (set) => ({
      step:           1,
      channelSlug:    '',
      contentType:    'longform',
      selectedTopic:  null,
      scriptContent:  '',
      retentionScore: null,
      seoPackage:     null,
      thumbnailData:  null,

      setStep:           (step)    => set({ step }),
      setChannel:        (slug)    => set({ channelSlug: slug }),
      setContentType:    (type)    => set({ contentType: type }),
      selectTopic:       (topic)   => set({ selectedTopic: topic, step: 2 }),
      setScript:         (content) => set({ scriptContent: content }),
      setRetentionScore: (score)   => set({ retentionScore: score }),
      setSeoPackage:     (pkg)     => set({ seoPackage: pkg }),
      setThumbnailData:  (data)    => set({ thumbnailData: data }),
      reset: () => set({
        step: 1, channelSlug: '', contentType: 'longform',
        selectedTopic: null, scriptContent: '', retentionScore: null,
        seoPackage: null, thumbnailData: null,
      }),
    }),
    {
      name:    'yt-create-workspace',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
