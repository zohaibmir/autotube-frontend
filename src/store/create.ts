import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentType = 'longform' | 'short' | 'kids'
export type CreateStep  = 1 | 2 | 3 | 4 | 5 | 6

// Visual Formats — creation wizard "Visuals" step (see VISUAL_FORMATS_COMPETITOR_ANALYSIS.md §10.2).
export type VisualSource = 'stock' | 'custom_video' | 'ai_image'
export type ArtStyle = 'anime' | 'comic' | 'watercolor' | 'photorealistic' | 'storybook' | 'gothic'

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
  voiceId: string
  retentionScore: number | null
  seoPackage: SeoPackage | null
  thumbnailData: Record<string, unknown> | null
  visualSource: VisualSource
  visualCustomVideoPath: string | null
  artStyle: ArtStyle | null
  bgMusicPath: string | null

  // Actions
  setStep: (step: CreateStep) => void
  setChannel: (slug: string) => void
  setContentType: (type: ContentType) => void
  selectTopic: (topic: TopicIdea) => void
  setScript: (content: string) => void
  setVoiceId: (voiceId: string) => void
  setRetentionScore: (score: number) => void
  setSeoPackage: (pkg: SeoPackage) => void
  setThumbnailData: (data: Record<string, unknown>) => void
  setVisualSource: (source: VisualSource) => void
  setVisualCustomVideoPath: (path: string | null) => void
  setArtStyle: (style: ArtStyle | null) => void
  setBgMusicPath: (path: string | null) => void
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
  visualSource:     'stock',
  visualCustomVideoPath: null,
  artStyle:         null,
  bgMusicPath:      null,
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
      voiceId:        '',
      retentionScore: null,
      seoPackage:     null,
      thumbnailData:  null,
      visualSource:   'stock',
      visualCustomVideoPath: null,
      artStyle:       null,
      bgMusicPath:    null,

      setStep:           (step)    => set({ step }),
      setChannel:        (slug)    => set({ channelSlug: slug }),
      setContentType:    (type)    => set({ contentType: type }),
      // Picking a topic must also clear any leftover script/SEO/thumbnail/
      // retention data from a PREVIOUS topic's draft - otherwise a stale
      // script from an old, never-fully-reset draft can silently get attached
      // to this new topic and the pipeline renders/uploads the wrong video.
      selectTopic:       (topic)   => set({
        selectedTopic: topic, step: 2,
        scriptContent: '', seoPackage: null, thumbnailData: null, retentionScore: null,
        visualSource: 'stock', visualCustomVideoPath: null, artStyle: null, bgMusicPath: null,
      }),
      setScript:         (content) => set({ scriptContent: content }),
      setVoiceId:        (voiceId) => set({ voiceId }),
      setRetentionScore: (score)   => set({ retentionScore: score }),
      setSeoPackage:     (pkg)     => set({ seoPackage: pkg }),
      setThumbnailData:  (data)    => set({ thumbnailData: data }),
      setVisualSource:   (source)  => set({ visualSource: source }),
      setVisualCustomVideoPath: (path) => set({ visualCustomVideoPath: path }),
      setArtStyle:       (style)   => set({ artStyle: style }),
      setBgMusicPath:    (path)    => set({ bgMusicPath: path }),
      reset: () => set({
        step: 1, channelSlug: '', contentType: 'longform',
        selectedTopic: null, scriptContent: '', voiceId: '', retentionScore: null,
        seoPackage: null, thumbnailData: null,
        visualSource: 'stock', visualCustomVideoPath: null, artStyle: null, bgMusicPath: null,
      }),
    }),
    {
      name:    'yt-create-workspace',
      // localStorage (not sessionStorage) so a draft survives closing the tab —
      // IdeasPage shows a "Resume draft" prompt when a prior selectedTopic exists.
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
