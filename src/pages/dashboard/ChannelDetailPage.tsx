import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, RefreshCw, Loader2, ExternalLink, CheckCircle2,
  XCircle, AlertCircle, Wand2, Wrench, Video, BarChart2, KeyRound, ShieldCheck,
  ImageIcon, Film, Upload, Search, Sparkles, Type, Languages, Trash2, RotateCcw,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useChannels } from '@hooks/useJobs'
import {
  channelOpsApi, analyticsApi, channelsApi, brandingApi, channelProfilesApi, voiceApi,
} from '@api/services'
import { useToast } from '@components/Toast'
import { apiErrorMessage } from '@lib/apiError'
import { openOAuthPopup } from '@lib/oauthPopup'
import { CTR_COLUMN_NOTE, ctrAsOf, ctrTooltip, fmtCtr } from '@lib/ctrReading'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// The subset of YouTube's category list a creator actually picks between. Ids are the API's lookup keys —
// the name is only a label — so the id is what gets stored. "Platform default" is an explicit option
// rather than a hidden fallback.
const _YT_CATEGORIES = [
  { id: '24', label: 'Entertainment' },
  { id: '27', label: 'Education' },
  { id: '28', label: 'Science & Technology' },
  { id: '15', label: 'Pets & Animals' },
  { id: '22', label: 'People & Blogs' },
  { id: '23', label: 'Comedy' },
  { id: '10', label: 'Music' },
  { id: '20', label: 'Gaming' },
  { id: '26', label: 'Howto & Style' },
  { id: '1', label: 'Film & Animation' },
  { id: '17', label: 'Sports' },
  { id: '19', label: 'Travel & Events' },
  { id: '29', label: 'Nonprofits & Activism' },
  { id: '25', label: 'News & Politics' },
]

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
      <div className="px-5 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">
        <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">{title}</p>
      </div>
      {children}
    </div>
  )
}

// ─── Video Defaults panel (per-channel visual source / art style / captions) ──

// "english" -> "English". The API returns canonical lowercase keys.
const _langLabel = (id: string) => id.charAt(0).toUpperCase() + id.slice(1)

const _ART_STYLE_OPTIONS = [
  { id: 'anime',          label: 'Anime Dream',      bestFor: 'anime, fantasy & action' },
  { id: 'comic',          label: 'Comic Pop',        bestFor: 'bold storytelling & drama' },
  { id: 'watercolor',     label: 'Soft Watercolor',  bestFor: 'calm, reflective topics' },
  { id: 'photorealistic', label: 'Cinematic Real',   bestFor: 'history & documentary' },
  { id: 'storybook',      label: 'Storybook Magic',  bestFor: 'kids & wholesome content' },
  { id: 'gothic',         label: 'Midnight Gothic',  bestFor: 'horror & mystery' },
]

function VideoDefaultsPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, error: profileError } = useQuery({
    queryKey: ['channel-profile', slug],
    queryFn: () => channelProfilesApi.get(slug),
    staleTime: 30_000,
  })
  const profile = data?.profile ?? {}

  // YouTube's own category list for the channel's region, not a hand-written one — the assignable list
  // differs by region, and this dropdown is what decides where future uploads are filed.
  const { data: categoryData } = useQuery({
    queryKey: ['video-categories', slug],
    queryFn: () => channelOpsApi.videoCategories(slug),
    staleTime: 60 * 60 * 1000,
  })
  const ytCategories = categoryData?.categories
    ?? _YT_CATEGORIES.map((c) => ({ id: c.id, title: c.label }))

  const [visualSource, setVisualSource] = useState<string>('stock')
  const [artStyle, setArtStyle] = useState<string>('')
  const [imageProvider, setImageProvider] = useState<string>('')
  const [captionsEnabled, setCaptionsEnabled] = useState(true)
  const [shortsDuration, setShortsDuration] = useState(120)
  const [madeForKids, setMadeForKids] = useState<'auto' | 'kids' | 'not_kids'>('auto')
  // YouTube category for uploads. Empty means "platform default" — the env var — and the label says so,
  // because a silent fallback is how this channel ended up in News & Politics for 74 videos.
  const [categoryId, setCategoryId] = useState<string>('')
  // Multilingual dubbing. `targetLanguages` is stored as one ordered list whose
  // first entry is the PRIMARY language (resolve_multilingual_config treats
  // languages[0] as primary and dubs every later entry), but it is friendlier to
  // hold the primary and the extras separately and compose on save.
  const [multilingualEnabled, setMultilingualEnabled] = useState(false)
  const [primaryLanguage, setPrimaryLanguage] = useState('english')
  const [extraLanguages, setExtraLanguages] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Canonical language list, served from voice_config.LANGUAGE_VOICES so the UI
  // cannot drift from the languages the pipeline can actually speak.
  const { data: dubbingLanguages } = useQuery({
    queryKey: ['dubbing-languages'],
    queryFn: () => voiceApi.languages(),
    staleTime: 60 * 60 * 1000,
  })

  if (!isLoading && !hydrated && data) {
    setVisualSource(profile.default_visual_source || 'stock')
    setArtStyle(profile.default_art_style || '')
    setImageProvider(profile.default_image_provider || '')
    setCaptionsEnabled(profile.captions_enabled !== false)
    setShortsDuration(profile.shorts_duration_seconds ?? 120)
    setMadeForKids(
      profile.made_for_kids === true ? 'kids'
        : profile.made_for_kids === false ? 'not_kids'
        : 'auto',
    )
    setMultilingualEnabled(Boolean(profile.multilingual_enabled))
    setCategoryId(profile.category_id ? String(profile.category_id) : '')
    // The column is TEXT, so it may arrive as a JSON array, a comma-separated
    // string, or null depending on how the row was written.
    const rawLangs = profile.target_languages
    const storedLangs: string[] = Array.isArray(rawLangs)
      ? rawLangs.map((x: unknown) => String(x).trim()).filter(Boolean)
      : typeof rawLangs === 'string' && rawLangs.trim()
        ? rawLangs.split(',').map((x: string) => x.trim()).filter(Boolean)
        : []
    const fallbackLang = String(profile.language || 'english').trim().toLowerCase()
    setPrimaryLanguage(storedLangs[0] || fallbackLang || 'english')
    setExtraLanguages(storedLangs.slice(1))
    setHydrated(true)
  }

  const save = useMutation({
    mutationFn: (fields: Parameters<typeof channelProfilesApi.update>[1]) =>
      channelProfilesApi.update(slug, fields),
    onSuccess: () => {
      toast.success('Video defaults saved')
      queryClient.invalidateQueries({ queryKey: ['channel-profile', slug] })
    },
    onError: () => toast.error('Save failed - try again'),
  })

  return (
    <SectionCard title="Video Defaults">
      <div className="px-5 py-4 space-y-4">
        {profileError && <p role="alert" className="text-xs text-red-600">Could not load channel defaults. Reload before saving.</p>}
        <p className="text-[11px] text-[#A3A3A3] -mt-1">
          Defaults for new videos on this channel. Can still be overridden per-video in the Visuals step.
        </p>

        {/* Default visual source */}
        <div>
          <p className="text-[11px] font-medium text-[#525252] mb-2">Default video source</p>
          <div className="flex gap-2">
            {[
              { id: 'stock', label: 'Stock', icon: <Film size={12} strokeWidth={1.5} /> },
              { id: 'custom_video', label: 'Custom video', icon: <Upload size={12} strokeWidth={1.5} /> },
              { id: 'ai_image', label: 'AI images', icon: <Sparkles size={12} strokeWidth={1.5} /> },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setVisualSource(opt.id)}
                className={[
                  'flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded border transition-colors',
                  visualSource === opt.id
                    ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                    : 'bg-white border-[#E5E5E5] text-[#525252] hover:border-[#D4D4D4]',
                ].join(' ')}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Default art style (only relevant when AI images is the default) */ }
        {visualSource === 'ai_image' && (
          <div>
            <p className="text-[11px] font-medium text-[#525252] mb-2">Default art style</p>
            <select
              value={artStyle}
              onChange={(e) => setArtStyle(e.target.value)}
              className="h-8 px-2 text-[12px] border border-[#E5E5E5] rounded bg-white text-[#0A0A0A]"
            >
              <option value="">Choose per video</option>
              {_ART_STYLE_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label} — {s.bestFor}</option>
              ))}
            </select>

            {/* Default AI image provider (only relevant when AI images is the default) */}
            <p className="text-[11px] font-medium text-[#525252] mb-2 mt-3">Default AI provider</p>
            <select
              value={imageProvider}
              onChange={(e) => setImageProvider(e.target.value)}
              className="h-8 px-2 text-[12px] border border-[#E5E5E5] rounded bg-white text-[#0A0A0A]"
            >
              <option value="">Platform default</option>
              <option value="openai">OpenAI gpt-image-1 (paid)</option>
              <option value="replicate">Replicate Flux/SDXL (paid, cheaper)</option>
              <option value="pollinations">Pollinations.ai (free)</option>
            </select>
            <p className="text-[10px] text-[#A3A3A3] mt-1">Overrides the platform-wide default in Settings → Automation.</p>
          </div>
        )}

        {/* Captions toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F5]">
          <div className="flex items-center gap-1.5">
            <Type size={13} strokeWidth={1.5} className="text-[#525252]" />
            <span className="text-[12px] font-medium text-[#0A0A0A]">Burned-in captions</span>
          </div>
          <button
            onClick={() => setCaptionsEnabled((v) => !v)}
            className={[
              'h-[20px] w-[36px] rounded-full transition-colors relative flex-shrink-0',
              captionsEnabled ? 'bg-[#16A34A]' : 'bg-[#D4D4D4]',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform shadow-sm',
                captionsEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]',
              ].join(' ')}
            />
          </button>
        </div>

        {/* Made for Kids — YouTube COPPA declaration, per channel */}
        <div className="pt-2 border-t border-[#F5F5F5]">
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldCheck size={13} strokeWidth={1.5} className="text-[#525252]" />
            <span className="text-[12px] font-medium text-[#0A0A0A]">Made for Kids</span>
          </div>
          <p className="text-[11px] text-[#A3A3A3] mb-2">
            YouTube requires this declaration for content aimed at children. This is
            per-channel, so a kids channel and an adult channel can coexist on one account.
          </p>
          <div className="flex gap-2">
            {([
              { id: 'auto', label: 'Auto-detect' },
              { id: 'kids', label: 'For kids' },
              { id: 'not_kids', label: 'Not for kids' },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setMadeForKids(opt.id)}
                className={[
                  'h-7 px-2.5 text-[11px] font-medium rounded border transition-colors',
                  madeForKids === opt.id
                    ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                    : 'bg-white border-[#E5E5E5] text-[#525252] hover:border-[#D4D4D4]',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#A3A3A3] mt-2">
            {madeForKids === 'auto'
              ? 'Detected automatically from this channel\'s audience.'
              : madeForKids === 'kids'
              ? 'Videos upload declared as made for kids (comments turn off).'
              : 'Videos upload declared as NOT made for kids.'}
          </p>
        </div>

        {/* Multi-language dubbing — one extra upload per extra language */}
        <div className="pt-2 border-t border-[#F5F5F5]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Languages size={13} strokeWidth={1.5} className="text-[#525252]" />
              <span className="text-[12px] font-medium text-[#0A0A0A]">Multi-language dubbing</span>
            </div>
            <button
              onClick={() => setMultilingualEnabled((v) => !v)}
              aria-label="Toggle multi-language dubbing"
              aria-pressed={multilingualEnabled}
              className={[
                'h-[20px] w-[36px] rounded-full transition-colors relative flex-shrink-0',
                multilingualEnabled ? 'bg-[#16A34A]' : 'bg-[#D4D4D4]',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform shadow-sm',
                  multilingualEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]',
                ].join(' ')}
              />
            </button>
          </div>
          <p className="text-[11px] text-[#A3A3A3] mt-1">
            {!multilingualEnabled
              ? "One upload, in this channel's language only."
              : extraLanguages.length > 0
                ? `One extra upload per video, dubbed into ${extraLanguages.map(_langLabel).join(', ')}.`
                : 'Choose at least one extra language below — otherwise nothing extra is uploaded.'}
          </p>
          {multilingualEnabled && (
            <div className="mt-2 space-y-2">
              <div>
                <label className="text-[11px] font-medium text-[#525252] block mb-1">
                  This channel&apos;s language
                </label>
                <select
                  value={primaryLanguage}
                  onChange={(e) => setPrimaryLanguage(e.target.value)}
                  className="h-8 px-2 text-[12px] border border-[#E5E5E5] rounded bg-white text-[#0A0A0A]"
                >
                  {(dubbingLanguages ?? [primaryLanguage]).map((l) => (
                    <option key={l} value={l}>{_langLabel(l)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#525252] block mb-1">
                  Also dub into
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(dubbingLanguages ?? []).filter((l) => l !== primaryLanguage).map((id) => {
                    const on = extraLanguages.includes(id)
                    return (
                      <button
                        key={id}
                        onClick={() => setExtraLanguages((prev) =>
                          on ? prev.filter((x) => x !== id) : [...prev, id])}
                        className={[
                          'h-7 px-2.5 text-[11px] font-medium rounded border transition-colors',
                          on
                            ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                            : 'bg-white border-[#E5E5E5] text-[#525252] hover:border-[#D4D4D4]',
                        ].join(' ')}
                      >
                        {_langLabel(id)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-[11px] font-medium text-[#525252] block mb-1">
            YouTube category for new uploads
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-8 px-2 text-[12px] border border-[#E5E5E5] rounded bg-white text-[#0A0A0A]"
          >
            <option value="">Platform default</option>
            {ytCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <p className="text-[11px] text-[#A3A3A3] mt-1">
            Set per channel, so one account can run a science channel and a music channel without them
            competing for the same category. Changing this affects future uploads only — existing videos
            keep theirs.
          </p>
        </div>

        <label className="block text-xs">
          Default Shorts length (seconds)
          <input aria-label="Default Shorts length" type="number" min={30} max={180} step={1}
            value={shortsDuration} onChange={event => setShortsDuration(Number(event.target.value))}
            className="block border rounded p-2 mt-1" />
          <span className="text-[11px] text-[#737373]">30-180 seconds; 120s if unset. Applies to generated-script Shorts, not extracted or raw animated clips.</span>
        </label>

        <button
          onClick={() => save.mutate({
            shorts_duration_seconds: shortsDuration,
            default_visual_source: visualSource,
            default_art_style: visualSource === 'ai_image' ? (artStyle || undefined) : undefined,
            default_image_provider: visualSource === 'ai_image' ? (imageProvider || undefined) : undefined,
            captions_enabled: captionsEnabled,
            made_for_kids: madeForKids === 'auto' ? null : madeForKids === 'kids',
            category_id: categoryId || null,
            multilingual_enabled: multilingualEnabled,
            // languages[0] is the primary; every later entry gets its own upload,
            // which is why a list of length 1 means "no variants".
            target_languages: [primaryLanguage, ...extraLanguages],
          })}
          disabled={save.isPending || isLoading || !!profileError || !Number.isInteger(shortsDuration) || shortsDuration < 30 || shortsDuration > 180}
          className="h-8 px-3 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          {save.isPending ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" /> : null}
          Save defaults
        </button>
      </div>
    </SectionCard>
  )
}

function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-[#A3A3A3] text-[12px]">—</span>
  const color = score >= 80 ? 'text-[#16A34A]' : score >= 50 ? 'text-[#D97706]' : 'text-[#DC2626]'
  return <span className={`text-[13px] font-semibold ${color}`}>{score}/100</span>
}

function AuditRow({ label, value, status }: { label: string; value?: string; status?: 'ok' | 'warn' | 'error' | null }) {
  const icon = status === 'ok'
    ? <CheckCircle2 size={12} strokeWidth={1.5} className="text-[#16A34A]" />
    : status === 'warn'
    ? <AlertCircle size={12} strokeWidth={1.5} className="text-[#D97706]" />
    : status === 'error'
    ? <XCircle size={12} strokeWidth={1.5} className="text-[#DC2626]" />
    : null

  return (
    <div className="flex items-start gap-3 px-5 py-3 border-b border-[#F5F5F5] last:border-b-0">
      <div className="w-4 flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#0A0A0A]">{label}</p>
        {value && <p className="text-[11px] text-[#A3A3A3] mt-0.5 truncate">{value}</p>}
      </div>
    </div>
  )
}

// ─── Audit panel ─────────────────────────────────────────────────────────────

function AuditPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['channel-audit', slug],
    queryFn: () => channelOpsApi.audit(slug),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const fixAll = useMutation({
    mutationFn: () => channelOpsApi.fixAll(slug),
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success(`Fixed ${res.fixed ?? 0} videos`)
        queryClient.invalidateQueries({ queryKey: ['channel-audit', slug] })
        queryClient.invalidateQueries({ queryKey: ['channel-videos', slug] })
      } else {
        toast.error(res?.error ?? 'Fix all failed')
      }
    },
    onError: () => toast.error('Fix all failed'),
  })

  if (isLoading) return (
    <SectionCard title="SEO Audit">
      <div className="space-y-1 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-[#F5F5F5] rounded animate-pulse" />
        ))}
      </div>
    </SectionCard>
  )

  const audit = data?.audit ?? data ?? {}
  const issues: any[] = audit.issues ?? []
  const score = audit.score ?? null
  const hasIssues = issues.length > 0

  return (
    <SectionCard title="SEO Audit">
      {/* Score + actions row */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F5F5F5]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#A3A3A3]">Overall score</span>
          <ScoreBadge score={score} />
        </div>
        <div className="flex items-center gap-2">
          {hasIssues && (
            <button
              onClick={() => fixAll.mutate()}
              disabled={fixAll.isPending}
              className="h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {fixAll.isPending
                ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                : <Wrench size={11} strokeWidth={1.5} />
              }
              Fix all
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh channel data"
            className="h-7 w-7 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded transition-colors"
          >
            <RefreshCw size={11} strokeWidth={1.5} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {data?.ok === false && (
        <div className="px-5 py-4 text-[12px] text-[#DC2626] bg-[#FFF1F2]">
          {data.error ?? 'Audit failed'}
        </div>
      )}

      {issues.length === 0 && data?.ok !== false && (
        <div className="px-5 py-8 text-center text-[12px] text-[#A3A3A3]">
          <CheckCircle2 size={20} strokeWidth={1.5} className="text-[#16A34A] mx-auto mb-2" />
          No issues found
        </div>
      )}

      {issues.map((issue: any, i: number) => (
        <AuditRow
          key={i}
          label={issue.message ?? issue.title ?? issue.type ?? JSON.stringify(issue)}
          value={issue.detail ?? issue.video_title ?? undefined}
          status={issue.severity === 'error' ? 'error' : issue.severity === 'warn' ? 'warn' : 'ok'}
        />
      ))}
    </SectionCard>
  )
}

// ─── AI Coach panel ───────────────────────────────────────────────────────────

function AICoachPanel({ slug }: { slug: string }) {
  const toast = useToast()

  const coach = useMutation({
    mutationFn: () => channelOpsApi.auditCoach(slug),
    onError: () => toast.error('AI coaching failed'),
  })

  const result = coach.data
  const priorities: any[] = result?.priorities ?? []

  return (
    <SectionCard title="AI Coach">
      <div className="px-5 py-4">
        {!coach.data && !coach.isPending && (
          <div className="text-center py-4">
            <Wand2 size={20} strokeWidth={1.5} className="text-[#D4D4D4] mx-auto mb-2" />
            <p className="text-[12px] text-[#525252] mb-3">
              Get a plain-English read on this channel's health and prioritized, channel-specific next steps - not just a checklist.
            </p>
            <button
              onClick={() => coach.mutate()}
              className="h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors inline-flex items-center gap-1.5"
            >
              <Wand2 size={11} strokeWidth={1.5} />
              Get AI coaching
            </button>
          </div>
        )}

        {coach.isPending && (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 bg-[#F5F5F5] rounded animate-pulse" />
            ))}
          </div>
        )}

        {result && !result.ok && (
          <div className="text-[12px] text-[#DC2626] bg-[#FFF1F2] -mx-5 -my-4 px-5 py-4">
            {result.error ?? 'AI coaching failed'}
          </div>
        )}

        {result?.ok && (
          <div className="space-y-4">
            <p className="text-[12px] text-[#0A0A0A] leading-relaxed">{result.summary}</p>

            {priorities.length > 0 && (
              <div className="space-y-2.5">
                {priorities.map((p: any, i: number) => (
                  <div key={i} className="border border-[#E5E5E5] rounded-lg p-3">
                    <p className="text-[12px] font-semibold text-[#0A0A0A] mb-1">{i + 1}. {p.title}</p>
                    {p.why && <p className="text-[11px] text-[#525252] mb-1"><span className="font-medium text-[#A3A3A3]">Why:</span> {p.why}</p>}
                    {p.action && <p className="text-[11px] text-[#525252]"><span className="font-medium text-[#A3A3A3]">Do:</span> {p.action}</p>}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => coach.mutate()}
              disabled={coach.isPending}
              className="h-6 px-2.5 text-[10px] font-medium border border-[#E5E5E5] rounded text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors inline-flex items-center gap-1"
            >
              <RefreshCw size={9} strokeWidth={1.5} />
              Regenerate
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Competitor Benchmark panel ────────────────────────────────────────────────

function BenchmarkPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const [compareValue, setCompareValue] = useState('')

  const benchmark = useMutation({
    mutationFn: (compare: string) => channelOpsApi.benchmark(compare, slug),
    onError: () => toast.error('Benchmark failed'),
  })

  const result = benchmark.data
  const mine = result?.your_channel
  const theirs = result?.compared_channel

  const fmtNum = (n?: number) => n == null ? '—' : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

  return (
    <SectionCard title="Competitor Benchmark">
      <div className="px-5 py-4 space-y-3">
        <p className="text-[12px] text-[#525252]">Compare your channel against any public YouTube channel - paste a handle, URL, or channel ID.</p>
        <div className="flex gap-2">
          <input
            value={compareValue}
            onChange={(e) => setCompareValue(e.target.value)}
            placeholder="@channelname or youtube.com/@channelname"
            className="flex-1 h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
          />
          <button
            onClick={() => compareValue.trim() && benchmark.mutate(compareValue.trim())}
            disabled={benchmark.isPending || !compareValue.trim()}
            className="h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {benchmark.isPending ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : <BarChart2 size={11} strokeWidth={1.5} />}
            Compare
          </button>
        </div>

        {result && !result.ok && (
          <div className="text-[12px] text-[#DC2626] bg-[#FFF1F2] rounded px-3 py-2">
            {result.error ?? 'Benchmark failed'}
          </div>
        )}

        {result?.ok && mine && theirs && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Channel', mine: mine.title, theirs: theirs.title },
                { label: 'Subscribers', mine: fmtNum(mine.subscribers), theirs: fmtNum(theirs.subscribers) },
                { label: 'Videos', mine: fmtNum(mine.videos), theirs: fmtNum(theirs.videos) },
                { label: 'Total views', mine: fmtNum(mine.views), theirs: fmtNum(theirs.views) },
                { label: 'Avg days/upload', mine: mine.avg_days_between_uploads ?? '—', theirs: theirs.avg_days_between_uploads ?? '—' },
              ].map((row) => (
                <React.Fragment key={row.label}>
                  <div className="text-[11px] text-[#A3A3A3] col-span-2 uppercase tracking-widest pt-1 first:pt-0">{row.label}</div>
                  <div className="text-[12px] text-[#0A0A0A] font-medium -mt-2">{row.mine}</div>
                  <div className="text-[12px] text-[#525252] -mt-2">{row.theirs}</div>
                </React.Fragment>
              ))}
            </div>
            {result.narrative && (
              <p className="text-[12px] text-[#0A0A0A] leading-relaxed border-t border-[#F5F5F5] pt-3 whitespace-pre-line">{result.narrative}</p>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Keyword Clusters panel ────────────────────────────────────────────────────

function KeywordClustersPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const [topic, setTopic] = useState('')

  const clusters = useMutation({
    mutationFn: (t: string) => channelOpsApi.keywordClusters(t, slug),
    onError: (err: any) => {
      toast.error(apiErrorMessage(err, 'Keyword lookup failed'))
    },
  })

  const result = clusters.data
  const competitionColor = (level: string) =>
    level === 'low' ? 'text-[#16A34A] bg-[#F0FDF4] border-[#BBF7D0]'
    : level === 'high' ? 'text-[#BE123C] bg-[#FFF1F2] border-[#FECDD3]'
    : 'text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]'

  return (
    <SectionCard title="Keyword Clusters">
      <div className="px-5 py-4 space-y-3">
        <p className="text-[12px] text-[#525252]">
          Enter a video topic - we'll pull real top-ranking titles and YouTube's own approximate
          result count for a few real search phrases, then group them by intent with a recommendation.
          Limited to 5 lookups/hour (each one uses real YouTube API quota).
        </p>
        <div className="flex gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. how to save money as a student"
            className="flex-1 h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
          />
          <button
            onClick={() => topic.trim() && clusters.mutate(topic.trim())}
            disabled={clusters.isPending || !topic.trim()}
            className="h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {clusters.isPending ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : <Search size={11} strokeWidth={1.5} />}
            Analyze
          </button>
        </div>

        {result && !result.ok && (
          <div className="text-[12px] text-[#DC2626] bg-[#FFF1F2] rounded px-3 py-2">
            {result.error ?? 'Keyword lookup failed'}
          </div>
        )}

        {result?.ok && (result.clusters || []).length > 0 && (
          <div className="space-y-3">
            {result.clusters.map((c: any, i: number) => (
              <div key={i} className="border border-[#F5F5F5] rounded-md p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[12px] font-semibold text-[#0A0A0A]">{c.name}</p>
                  <span className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded border ${competitionColor(c.competition)}`}>
                    {c.competition} competition
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(c.keywords || []).map((k: string) => (
                    <span key={k} className="text-[10px] text-[#525252] bg-[#FAFAFA] border border-[#E5E5E5] rounded px-1.5 py-0.5">{k}</span>
                  ))}
                </div>
                <p className="text-[11px] text-[#525252] leading-relaxed">{c.recommendation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Rank Tracking panel ───────────────────────────────────────────────────────

function CollabPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const find = useMutation<any, any, void>({
    mutationFn: () => channelOpsApi.collaborators(slug),
    onError: (err: any) => toast.error(apiErrorMessage(err, 'Could not look for collaboration partners')),
  })

  const result: any = find.data
  const picks: any[] = result?.picks ?? []

  const copy = (channelId: string, text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => { setCopiedId(channelId); toast.success('Outreach message copied') })
      .catch(() => toast.error('Could not copy - select the text manually'))
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-md p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Collaboration Ideas</p>
        <button
          onClick={() => find.mutate()}
          disabled={find.isPending}
          className="flex-shrink-0 inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md bg-[#0A0A0A] text-white hover:bg-[#171717] disabled:opacity-50"
        >
          {find.isPending
            ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
            : <Search size={12} strokeWidth={1.5} />}
          {picks.length ? 'Look again' : 'Find partners'}
        </button>
      </div>

      {/* The description is a sibling of the title, not a column beside the button. Sharing that row with a
          158px button in a 348px card left the text 174px wide — it wrapped every three words and read as a
          layout fault. Title and action on one line, description at full width below, which is the vertical
          order Primer's Blankslate guidance uses (title, description, then the action). */}
      <p className="text-[12px] text-[#737373] mt-1 leading-5">
        Channels in this niche whose audience overlaps without competing for the same uploads.
        Nothing is sent on your behalf and no views are traded - you decide whether to reach out.
      </p>

      {find.isPending && (
        <p className="text-[12px] text-[#A3A3A3] mt-4">
          Searching YouTube for channels in this niche, then picking the closest fits…
        </p>
      )}

      {!find.isPending && result && !result.ok && (
        <p className="text-[12px] text-[#B45309] mt-4">{result.error || 'No suggestions available.'}</p>
      )}

      {!find.isPending && picks.length > 0 && (
        <div className="mt-5 space-y-4">
          {picks.map((pick) => (
            <div key={pick.channel_id} className="border-l-2 border-[#E5E5E5] pl-4">
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={pick.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] font-medium text-[#0A0A0A] hover:underline inline-flex items-center gap-1"
                >
                  {pick.title}
                  <ExternalLink size={11} strokeWidth={1.5} className="text-[#A3A3A3]" />
                </a>
                {pick.handle && <span className="text-[11px] text-[#A3A3A3]">@{pick.handle}</span>}
                {pick.subscribers > 0 && (
                  <span className="text-[11px] text-[#A3A3A3]">
                    {pick.subscribers.toLocaleString()} subscribers
                  </span>
                )}
              </div>
              {pick.why && <p className="text-[12px] text-[#525252] mt-1.5 leading-5">{pick.why}</p>}
              {pick.complement && (
                <p className="text-[12px] text-[#737373] mt-1 leading-5">
                  <span className="text-[#A3A3A3]">They bring:</span> {pick.complement}
                </p>
              )}
              {pick.outreach && (
                <div className="mt-2 bg-[#FAFAFA] border border-[#E5E5E5] rounded-md p-3">
                  <p className="text-[11px] text-[#A3A3A3] uppercase tracking-widest mb-1">Suggested message</p>
                  <p className="text-[12px] text-[#0A0A0A] whitespace-pre-wrap leading-5">{pick.outreach}</p>
                  <button
                    onClick={() => copy(pick.channel_id, pick.outreach)}
                    className="mt-2 text-[11px] text-[#525252] hover:text-[#0A0A0A] underline"
                  >
                    {copiedId === pick.channel_id ? 'Copied' : 'Copy message'}
                  </button>
                </div>
              )}
            </div>
          ))}
          {Array.isArray(result?.dropped) && result.dropped.length > 0 && (
            <p className="text-[11px] text-[#A3A3A3]">
              {result.dropped.length} suggestion{result.dropped.length === 1 ? '' : 's'} pointed at a
              channel we couldn't confirm, so {result.dropped.length === 1 ? 'it was' : 'they were'} left out.
            </p>
          )}
          {Array.isArray(result?.dropped_oversized) && result.dropped_oversized.length > 0 && (
            <p className="text-[11px] text-[#A3A3A3]">
              {result.dropped_oversized.length} much larger channel
              {result.dropped_oversized.length === 1 ? ' was' : 's were'} left out — a partner with 100×
              your reach is not a realistic ask.
            </p>
          )}
        </div>
      )}

      {!find.isPending && (result?.candidates?.length ?? 0) > 0 && (
        <p className="text-[11px] text-[#A3A3A3] mt-4">
          Compared {result.candidates.length} channel{result.candidates.length === 1 ? '' : 's'} found on
          YouTube. Lookups are capped per hour, so this may need a second try later.
        </p>
      )}
    </div>
  )
}

function RankTrackingPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const [videoId, setVideoId] = useState('')
  const [keyword, setKeyword] = useState('')

  const check = useMutation({
    mutationFn: () => channelOpsApi.rankCheck(videoId.trim(), keyword.trim(), slug),
    onSuccess: () => {
      history.refetch()
    },
    onError: (err: any) => {
      toast.error(apiErrorMessage(err, 'Rank check failed'))
    },
  })

  const history = useQuery({
    queryKey: ['rank-history', videoId, keyword],
    queryFn: () => channelOpsApi.rankHistory(videoId.trim(), keyword.trim()),
    enabled: false, // only fetch on demand - refetched after a successful check
  })

  const narrative = useMutation({
    mutationFn: () => channelOpsApi.rankNarrative(videoId.trim(), keyword.trim()),
    onError: (err: any) => {
      toast.error(apiErrorMessage(err, 'Could not explain rank movement'))
    },
  })

  const canQuery = videoId.trim().length > 0 && keyword.trim().length > 0
  const historyRows = history.data?.history || []

  return (
    <SectionCard title="Rank Tracking">
      <div className="px-5 py-4 space-y-3">
        <p className="text-[12px] text-[#525252]">
          Track where one of your videos ranks in real YouTube search results for a keyword over time.
          Each check is a real search - history builds as you check again later. Limited to 5 checks/hour.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            placeholder="Video ID (from the video's URL)"
            className="h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
          />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Keyword to track"
            className="h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => canQuery && check.mutate()}
            disabled={check.isPending || !canQuery}
            className="h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {check.isPending ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : <BarChart2 size={11} strokeWidth={1.5} />}
            Check rank now
          </button>
          <button
            onClick={() => canQuery && narrative.mutate()}
            disabled={narrative.isPending || !canQuery}
            className="h-7 px-3 text-[11px] font-medium border border-[#E5E5E5] text-[#0A0A0A] rounded hover:border-[#A3A3A3] disabled:opacity-40 transition-colors"
          >
            {narrative.isPending ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin inline" /> : null} Explain movement
          </button>
        </div>

        {check.data && !check.data.ok && (
          <div className="text-[12px] text-[#DC2626] bg-[#FFF1F2] rounded px-3 py-2">{check.data.error}</div>
        )}
        {check.data?.ok && (
          <div className="text-[12px] text-[#0A0A0A] bg-[#FAFAFA] rounded px-3 py-2">
            {check.data.rank
              ? <>Rank <strong>#{check.data.rank}</strong> of {check.data.checked_out_of} scanned</>
              : <>Not found in the top {check.data.checked_out_of} results</>}
            <span className="text-[#A3A3A3]"> · ~{check.data.total_results_estimate?.toLocaleString()} results (approximate)</span>
          </div>
        )}

        {narrative.data && !narrative.data.ok && (
          <div className="text-[12px] text-[#B45309] bg-[#FFFBEB] rounded px-3 py-2">{narrative.data.error}</div>
        )}
        {narrative.data?.ok && (
          <p className="text-[12px] text-[#0A0A0A] leading-relaxed border-t border-[#F5F5F5] pt-3">{narrative.data.narrative}</p>
        )}

        {historyRows.length > 0 && (
          <div className="pt-2 border-t border-[#F5F5F5]">
            <p className="text-[11px] text-[#A3A3A3] uppercase tracking-widest mb-1.5">History</p>
            <div className="space-y-1">
              {historyRows.map((h: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-[11px] text-[#525252]">
                  <span>{new Date(h.checked_at).toLocaleString()}</span>
                  <span className="font-medium text-[#0A0A0A]">{h.rank ? `#${h.rank}` : 'not found'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── OAuth Diagnostics panel ──────────────────────────────────────────────────

function OAuthDiagnosticsPanel() {
  const [open, setOpen] = useState(false)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['oauth-diagnostics'],
    queryFn: () => channelsApi.oauthDiagnostics(),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  })

  const diag = data ?? {}
  const tips: string[] = diag.tips ?? []
  const channels: any[] = diag.channels ?? []

  return (
    <SectionCard title="YouTube Auth">
      <div className="px-5 py-3.5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <KeyRound size={13} strokeWidth={1.5} className="text-[#525252]" />
            <span className="text-[12px] font-medium text-[#0A0A0A]">OAuth Diagnostics</span>
          </div>
          <div className="flex items-center gap-1.5">
            {open && (
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh OAuth diagnostics"
                className="h-6 w-6 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded transition-colors"
              >
                <RefreshCw size={10} strokeWidth={1.5} className={isFetching ? 'animate-spin' : ''} />
              </button>
            )}
            <button
              onClick={() => setOpen(v => !v)}
              className="h-6 px-2.5 text-[10px] font-medium border border-[#E5E5E5] rounded text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors"
            >
              {open ? 'Hide' : 'Run check'}
            </button>
          </div>
        </div>

        {open && (
          <>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-6 bg-[#F5F5F5] rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Credential status */}
                <div className="space-y-1.5">
                  {[
                    ['Web Client ID', diag.web_client_id?.present, diag.web_client_id?.masked],
                    ['Web Client Secret', diag.web_client_secret?.present, undefined],
                    ['client_secrets.json', diag.desktop_client_secrets?.exists, diag.desktop_client_secrets?.path],
                  ].map(([label, ok, detail]) => (
                    <div key={label as string} className="flex items-center gap-2">
                      {ok
                        ? <CheckCircle2 size={11} strokeWidth={1.5} className="text-[#16A34A] shrink-0" />
                        : <XCircle size={11} strokeWidth={1.5} className="text-[#DC2626] shrink-0" />
                      }
                      <span className="text-[11px] text-[#0A0A0A]">{label as string}</span>
                      {detail && <span className="text-[10px] text-[#A3A3A3] font-mono truncate">{detail as string}</span>}
                    </div>
                  ))}
                </div>

                {/* Channel token status */}
                {channels.length > 0 && (
                  <div className="border border-[#F5F5F5] rounded overflow-hidden mt-3">
                    {channels.map((ch: any) => {
                      // `has_token` only means a token *file* exists on disk - it
                      // doesn't mean Google still honors it. Use auth_status (the
                      // same field the Channels list page uses) so this panel
                      // doesn't claim "Token OK" for a revoked/expired channel.
                      const isOk = ch.auth_status ? ch.auth_status === 'ok' : ch.has_token
                      const label = ch.auth_status === 'revoked' ? 'Revoked'
                        : ch.auth_status === 'missing' ? 'No token'
                        : ch.auth_status === 'ok' ? 'Token OK'
                        : (ch.has_token ? 'Token OK' : 'No token')
                      return (
                        <div key={ch.slug} className="flex items-center gap-2 px-3 py-2 border-b border-[#F5F5F5] last:border-b-0" title={ch.auth_message || undefined}>
                          {isOk
                            ? <ShieldCheck size={11} strokeWidth={1.5} className="text-[#16A34A] shrink-0" />
                            : <XCircle size={11} strokeWidth={1.5} className="text-[#DC2626] shrink-0" />
                          }
                          <span className="text-[11px] text-[#0A0A0A] font-medium truncate flex-1">{ch.name || ch.slug}</span>
                          <span className={`text-[10px] font-medium ${isOk ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                            {label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Tips */}
                {tips.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertCircle size={10} strokeWidth={1.5} className="text-[#D97706] mt-0.5 shrink-0" />
                        <p className="text-[10px] text-[#525252]">{tip}</p>
                      </div>
                    ))}
                  </div>
                )}

                {tips.length === 0 && channels.every((c: any) => c.has_token) && (
                  <p className="text-[11px] text-[#16A34A] flex items-center gap-1.5 mt-1">
                    <CheckCircle2 size={11} strokeWidth={1.5} /> All credentials look good
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  )
}

// ─── SEO suggest panel ────────────────────────────────────────────────────────

function BrandingPanel({ slug, channel }: { slug: string; channel: any }) {
  const toast = useToast()
  const queryClient = useQueryClient()

  // ── SEO sub-state ────────────────────────────────────────────────────────
  const [seoSuggestions, setSeoSuggestions] = useState<{ description?: string; keywords?: string } | null>(null)
  const [seoApplied, setSeoApplied] = useState(false)

  // ── Visual Assets sub-state ──────────────────────────────────────────────
  const [brandTab,      setBrandTab]      = useState<'seo' | 'visual'>('seo')
  const [channelName,   setChannelName]   = useState<string>(channel?.name ?? slug)
  const [tagline,       setTagline]       = useState<string>(channel?.description?.slice(0, 80) ?? '')
  const [stylePreset,   setStylePreset]   = useState('default')
  const [trailerVideoId, setTrailerVideoId] = useState('')
  const [trailerDone,   setTrailerDone]   = useState(false)
  const [bannerDone,    setBannerDone]    = useState(false)

  const STYLE_PRESETS = ['default', 'dark dramatic', 'minimalist', 'vibrant', 'gradient', 'neon']

  // ── Assets query ─────────────────────────────────────────────────────────
  const assetsQuery = useQuery({
    queryKey: ['branding-assets', slug],
    queryFn:  () => brandingApi.listAssets(slug),
    staleTime: 30_000,
    enabled: brandTab === 'visual',
  })

  const assets = assetsQuery.data?.assets ?? []
  const banner    = assets.find((a) => a.name.includes('banner'))
  const avatar    = assets.find((a) => a.name.includes('avatar'))
  const watermark = assets.find((a) => a.name.includes('watermark'))

  // ── SEO mutations ─────────────────────────────────────────────────────────
  const suggest = useMutation({
    mutationFn: () => channelOpsApi.suggestBranding({
      channel: slug,
      title: channel?.name ?? slug,
      description: channel?.description,
      keywords: channel?.keywords,
    }),
    onSuccess: (res) => {
      if (res?.ok) setSeoSuggestions(res.suggestions)
      else toast.error(res?.error ?? 'Suggest failed')
    },
    onError: () => toast.error('Suggest failed'),
  })

  const apply = useMutation({
    mutationFn: () => channelOpsApi.update({
      channel: slug,
      description: seoSuggestions?.description,
      keywords: seoSuggestions?.keywords,
    }),
    onSuccess: (res) => {
      if (res?.ok) { toast.success('Channel updated'); setSeoApplied(true) }
      else toast.error(res?.error ?? 'Update failed')
    },
    onError: () => toast.error('Update failed'),
  })

  // ── Branding mutations ────────────────────────────────────────────────────
  const generateAssets = useMutation({
    mutationFn: () => brandingApi.generate({
      channel:     slug,
      channelName: channelName.trim() || (channel?.name ?? slug),
      tagline:     tagline.trim(),
      stylePreset,
    }),
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success('Branding assets generated')
        queryClient.invalidateQueries({ queryKey: ['branding-assets', slug], exact: false })
      } else {
        toast.error(res?.error ?? 'Generation failed')
      }
    },
    onError: () => toast.error('Generation failed'),
  })

  const uploadBanner = useMutation({
    mutationFn: () => brandingApi.uploadBanner(slug),
    onSuccess: (res) => {
      if (res?.ok) { toast.success('Banner uploaded to YouTube'); setBannerDone(true) }
      else toast.error(res?.error ?? 'Upload failed')
    },
    onError: () => toast.error('Banner upload failed'),
  })

  const setTrailer = useMutation({
    mutationFn: () => {
      if (!trailerVideoId.trim()) throw new Error('Enter a YouTube Video ID')
      return brandingApi.setTrailer(trailerVideoId.trim(), slug)
    },
    onSuccess: (res) => {
      if (res?.ok) { toast.success('Channel trailer set'); setTrailerDone(true) }
      else toast.error(res?.error ?? 'Set trailer failed')
    },
    onError: (err: any) => toast.error(err?.message ?? 'Set trailer failed'),
  })

  return (
    <SectionCard title="Branding">
      {/* Tab strip */}
      <div className="flex border-b border-[#E5E5E5]">
        {(['seo', 'visual'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setBrandTab(tab)}
            className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
              brandTab === tab
                ? 'text-[#0A0A0A] border-b-2 border-[#0A0A0A] -mb-px bg-white'
                : 'text-[#A3A3A3] hover:text-[#525252]'
            }`}
          >
            {tab === 'seo' ? 'SEO Copy' : 'Visual Assets'}
          </button>
        ))}
      </div>

      {/* SEO Tab */}
      {brandTab === 'seo' && (
        <div className="px-5 py-4 space-y-3">
          <p className="text-[12px] text-[#525252]">
            Generate an SEO-optimised description and keyword set using AI, then apply it directly to the channel.
          </p>
          {!seoSuggestions ? (
            <button
              onClick={() => suggest.mutate()}
              disabled={suggest.isPending}
              className="h-8 px-4 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {suggest.isPending
                ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                : <Wand2 size={11} strokeWidth={1.5} />
              }
              Generate suggestions
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Description</p>
                <p className="text-[12px] text-[#0A0A0A] bg-[#FAFAFA] border border-[#E5E5E5] rounded p-3 whitespace-pre-wrap">{seoSuggestions.description}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Keywords</p>
                <p className="text-[12px] text-[#0A0A0A] bg-[#FAFAFA] border border-[#E5E5E5] rounded p-3">{seoSuggestions.keywords}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => apply.mutate()}
                  disabled={apply.isPending || seoApplied}
                  className="h-8 px-4 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  {apply.isPending && <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />}
                  {seoApplied ? 'Applied' : 'Apply to channel'}
                </button>
                <button
                  onClick={() => { setSeoSuggestions(null); setSeoApplied(false) }}
                  className="h-8 px-3 text-[12px] text-[#525252] border border-[#E5E5E5] rounded hover:bg-[#FAFAFA] transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visual Assets Tab */}
      {brandTab === 'visual' && (
        <div className="px-5 py-4 space-y-4">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Channel Name</p>
              <input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
              />
            </div>
            <div>
              <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Style Preset</p>
              <select
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value)}
                className="w-full h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
              >
                {STYLE_PRESETS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Tagline</p>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Short tagline displayed on the banner…"
              className="w-full h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
            />
          </div>

          <button
            onClick={() => generateAssets.mutate()}
            disabled={generateAssets.isPending}
            className="flex items-center gap-1.5 h-8 px-4 bg-[#0A0A0A] text-white text-[12px] font-medium rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
          >
            {generateAssets.isPending
              ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
              : <Wand2 size={11} strokeWidth={1.5} />
            }
            {generateAssets.isPending ? 'Generating…' : 'Generate Assets'}
          </button>

          {/* Asset previews */}
          {assetsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={12} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
              <span className="text-[12px] text-[#A3A3A3]">Loading assets…</span>
            </div>
          ) : assets.length > 0 ? (
            <div className="space-y-3">
              {/* Banner */}
              {banner && (
                <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
                  <div className="bg-[#F5F5F5] px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-[#525252] uppercase tracking-widest">Banner</span>
                    <span className="text-[10px] text-[#A3A3A3]">2160×1080</span>
                  </div>
                  {banner.url && (
                    <div className="aspect-[2/1] bg-[#F5F5F5] overflow-hidden">
                      <img src={banner.url} alt="Channel banner" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="px-3 py-2 flex justify-end">
                    <button
                      onClick={() => { setBannerDone(false); uploadBanner.mutate() }}
                      disabled={uploadBanner.isPending}
                      className="flex items-center gap-1 h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
                    >
                      {bannerDone ? (
                        <><CheckCircle2 size={11} strokeWidth={1.5} /> Uploaded</>
                      ) : uploadBanner.isPending ? (
                        <><Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> Uploading…</>
                      ) : (
                        <><Upload size={11} strokeWidth={1.5} /> Upload to YouTube</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Avatar + Watermark row */}
              <div className="grid grid-cols-2 gap-3">
                {avatar && (
                  <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
                    <div className="bg-[#F5F5F5] px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-[#525252] uppercase tracking-widest">Avatar</span>
                      <span className="text-[10px] text-[#A3A3A3]">800×800</span>
                    </div>
                    {avatar.url && (
                      <div className="aspect-square bg-[#F5F5F5] overflow-hidden">
                        <img src={avatar.url} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                )}
                {watermark && (
                  <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
                    <div className="bg-[#F5F5F5] px-3 py-1.5">
                      <span className="text-[10px] font-medium text-[#525252] uppercase tracking-widest">Watermark</span>
                    </div>
                    {watermark.url && (
                      <div className="aspect-square bg-[#F5F5F5] overflow-hidden flex items-center justify-center p-4">
                        <img src={watermark.url} alt="Watermark" className="max-w-full max-h-full object-contain" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center gap-2 text-center">
              <ImageIcon size={24} strokeWidth={1} className="text-[#D4D4D4]" />
              <p className="text-[12px] text-[#A3A3A3]">No assets yet - click Generate Assets above</p>
            </div>
          )}

          {/* Trailer section */}
          <div className="pt-3 border-t border-[#F5F5F5]">
            <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Channel Trailer</p>
            <p className="text-[11px] text-[#525252] mb-2">Set an existing YouTube video as the channel trailer for non-subscribers.</p>
            <div className="flex gap-2">
              <input
                value={trailerVideoId}
                onChange={(e) => { setTrailerVideoId(e.target.value); setTrailerDone(false) }}
                placeholder="YouTube Video ID…"
                className="flex-1 h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3] font-mono"
              />
              <button
                onClick={() => setTrailer.mutate()}
                disabled={setTrailer.isPending || !trailerVideoId.trim() || trailerDone}
                className="flex items-center gap-1 h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
              >
                {trailerDone ? (
                  <><CheckCircle2 size={11} strokeWidth={1.5} /> Set</>
                ) : setTrailer.isPending ? (
                  <><Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> Setting…</>
                ) : (
                  <><Film size={11} strokeWidth={1.5} /> Set Trailer</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Bulk metadata edit (a user-specified change, with a dry run) ─────────────

type BulkOp = { field: string; action: string; value: any }

const _BULK_FIELDS: Array<{ id: string; label: string; actions: string[] }> = [
  { id: 'description', label: 'Description', actions: ['append', 'prepend', 'replace', 'set'] },
  { id: 'title',       label: 'Title',       actions: ['append', 'prepend', 'replace', 'set'] },
  { id: 'tags',        label: 'Tags',        actions: ['add', 'remove', 'set'] },
]

// Appending the same text twice appends it twice, so "apply" is not idempotent for every operation. The
// preview is what makes that visible before it happens.
function BulkEditPanel({
  slug, videoIds, onApplied, onClose,
}: { slug: string; videoIds: string[]; onApplied: () => void; onClose: () => void }) {
  const toast = useToast()
  const [ops, setOps] = useState<BulkOp[]>([{ field: 'description', action: 'append', value: '' }])
  const [preview, setPreview] = useState<any>(null)

  // Every edit clears the preview. Applying a preview that no longer matches the operations is the one way
  // this panel could write something other than what it showed, so it cannot happen: no preview, no apply.
  const edit = (index: number, patch: Partial<BulkOp>) => {
    setOps(prev => prev.map((op, i) => (i === index ? { ...op, ...patch } : op)))
    setPreview(null)
  }

  const previewMutation = useMutation({
    mutationFn: () => channelOpsApi.bulkPreview(videoIds, ops, slug),
    onSuccess: (res) => {
      setPreview(res)
      if (res?.ok === false) toast.error(res?.error ?? 'Could not preview that edit')
    },
    onError: (e: any) => toast.error(apiErrorMessage(e, 'Could not preview that edit')),
  })

  const applyMutation = useMutation({
    mutationFn: () => channelOpsApi.bulkApply(videoIds, ops, slug, true),
    onSuccess: (res) => {
      if (res?.ok) {
        const skipped = res.skipped ? `, ${res.skipped} needed no change` : ''
        const failed = res.failed ? `, ${res.failed} failed` : ''
        toast.success(`Updated ${res.changed ?? 0} of ${res.attempted ?? videoIds.length} videos${skipped}${failed}`)
        setPreview(null)
        onApplied()
      } else {
        toast.error(res?.error ?? 'Bulk edit failed')
      }
    },
    onError: (e: any) => toast.error(apiErrorMessage(e, 'Bulk edit failed')),
  })

  const planned = preview?.planned ?? []
  const blocked = preview?.blocked ?? []
  const counts = preview?.counts
  const canApply = Boolean(preview) && preview?.ok !== false && planned.length > 0

  const valueInput = (op: BulkOp, index: number) => {
    if (op.action === 'replace') {
      const v = (op.value && typeof op.value === 'object') ? op.value : { find: '', replace: '' }
      return (
        <div className="flex items-center gap-1.5 flex-1">
          <input
            value={v.find ?? ''}
            onChange={e => edit(index, { value: { ...v, find: e.target.value } })}
            placeholder="find"
            className="h-7 flex-1 min-w-0 px-2 text-[11px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A]"
          />
          <span className="text-[10px] text-[#A3A3A3]">→</span>
          <input
            value={v.replace ?? ''}
            onChange={e => edit(index, { value: { ...v, replace: e.target.value } })}
            placeholder="replace with"
            className="h-7 flex-1 min-w-0 px-2 text-[11px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A]"
          />
        </div>
      )
    }
    const isTags = op.field === 'tags'
    return (
      <input
        value={typeof op.value === 'string' ? op.value : ''}
        onChange={e => edit(index, { value: e.target.value })}
        placeholder={isTags ? 'tag one, tag two' : op.action === 'append' ? 'text to add at the end' : 'text'}
        className="h-7 flex-1 min-w-0 px-2 text-[11px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A]"
      />
    )
  }

  return (
    <div className="border-b border-[#E5E5E5] bg-white px-5 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">
          Bulk edit {videoIds.length} video{videoIds.length === 1 ? '' : 's'}
        </p>
        <button onClick={onClose} className="text-[10px] font-medium text-[#525252] hover:text-[#0A0A0A]">
          Close
        </button>
      </div>

      <div className="space-y-1.5">
        {ops.map((op, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <select
              value={op.field}
              onChange={e => {
                const field = e.target.value
                const actions = _BULK_FIELDS.find(f => f.id === field)?.actions ?? ['set']
                edit(index, { field, action: actions[0], value: '' })
              }}
              className="h-7 px-1.5 text-[11px] border border-[#E5E5E5] rounded bg-white"
            >
              {_BULK_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <select
              value={op.action}
              onChange={e => edit(index, { action: e.target.value, value: '' })}
              className="h-7 px-1.5 text-[11px] border border-[#E5E5E5] rounded bg-white"
            >
              {(_BULK_FIELDS.find(f => f.id === op.field)?.actions ?? []).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {valueInput(op, index)}
            {ops.length > 1 && (
              <button
                onClick={() => { setOps(prev => prev.filter((_, i) => i !== index)); setPreview(null) }}
                className="h-7 px-1.5 text-[#A3A3A3] hover:text-[#DC2626]"
                title="Remove this operation"
              >
                <Trash2 size={11} strokeWidth={1.5} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <button
          onClick={() => setOps(prev => [...prev, { field: 'description', action: 'append', value: '' }])}
          className="h-6 px-2 text-[10px] font-medium text-[#525252] hover:text-[#0A0A0A]"
        >
          + Add operation
        </button>
        <button
          onClick={() => previewMutation.mutate()}
          disabled={previewMutation.isPending}
          className="h-6 px-2.5 text-[11px] font-medium border border-[#E5E5E5] rounded hover:border-[#0A0A0A] disabled:opacity-40 flex items-center gap-1.5"
        >
          {previewMutation.isPending
            ? <Loader2 size={10} strokeWidth={1.5} className="animate-spin" />
            : <Search size={10} strokeWidth={1.5} />}
          Preview
        </button>
        <button
          onClick={() => applyMutation.mutate()}
          disabled={!canApply || applyMutation.isPending}
          className="h-6 px-2.5 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 flex items-center gap-1.5"
          title={canApply ? 'Write these changes to YouTube' : 'Preview first'}
        >
          {applyMutation.isPending
            ? <Loader2 size={10} strokeWidth={1.5} className="animate-spin" />
            : <CheckCircle2 size={10} strokeWidth={1.5} />}
          Apply to {planned.length || 0}
        </button>
        {!preview && (
          <span className="text-[10px] text-[#A3A3A3]">Preview first — nothing is written until you apply.</span>
        )}
      </div>

      {preview && (
        <div className="mt-2.5 border border-[#E5E5E5] rounded">
          <div className="px-3 py-1.5 bg-[#FAFAFA] border-b border-[#E5E5E5] flex items-center gap-3 text-[10px] flex-wrap">
            <span className="text-[#0A0A0A] font-medium">{counts?.planned ?? 0} will change</span>
            <span className="text-[#A3A3A3]">{counts?.skipped ?? 0} already match</span>
            {blocked.length > 0 && <span className="text-[#B45309]">{blocked.length} cannot be changed</span>}
            {preview.missing?.length > 0 && (
              <span className="text-[#A3A3A3]">{preview.missing.length} not found on YouTube</span>
            )}
          </div>
          <div className="max-h-56 overflow-auto divide-y divide-[#F5F5F5]">
            {planned.slice(0, 12).map((row: any) => (
              <div key={row.video_id} className="px-3 py-1.5">
                <p className="text-[11px] text-[#0A0A0A] truncate">{row.title}</p>
                {row.changes.map((change: any, i: number) => (
                  <p key={i} className="text-[10px] text-[#525252] mt-0.5">
                    <span className="text-[#A3A3A3]">{change.field}:</span>{' '}
                    {change.field === 'tags'
                      ? `${(change.before || []).length} tags → ${(change.after || []).length} tags`
                      : <>{_truncate(change.before)} → <span className="text-[#0A0A0A]">{_truncate(change.after)}</span></>}
                  </p>
                ))}
              </div>
            ))}
            {planned.length > 12 && (
              <div className="px-3 py-1.5 text-[10px] text-[#A3A3A3]">
                and {planned.length - 12} more
              </div>
            )}
            {blocked.map((row: any) => (
              <div key={row.video_id} className="px-3 py-1.5">
                <p className="text-[11px] text-[#0A0A0A] truncate">{row.title}</p>
                {row.reasons.map((reason: string, i: number) => (
                  <p key={i} className="text-[10px] text-[#B45309] mt-0.5">{reason}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {preview?.ok === false && (
        <div className="mt-2 text-[10px] text-[#DC2626] space-y-0.5">
          {(preview.errors ?? []).map((err: string, i: number) => <p key={i}>{err}</p>)}
        </div>
      )}
    </div>
  )
}

// Long descriptions would otherwise push the diff off the row.
function _truncate(text: string) {
  const value = String(text ?? '')
  return value.length > 120 ? value.slice(0, 120) + '…' : value
}

// ─── Video history ────────────────────────────────────────────────────────────

// Ten rows per page. Chosen so the table plus its heading fits beside the rail without the reader losing
// sight of the page header -- the previous 30 rows ran to roughly 1,400px with no controls attached.
const VIDEOS_PAGE_SIZE = 10

function VideosPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [needle, setNeedle] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['channel-videos', slug],
    queryFn: () => analyticsApi.videos(50),
    staleTime: 60_000,
  })

  const fixVideo = useMutation({
    mutationFn: (videoId: string) => channelOpsApi.fixVideo(videoId, slug),
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success('Video SEO updated')
        queryClient.invalidateQueries({ queryKey: ['channel-videos', slug] })
      } else {
        toast.error(res?.error ?? 'Fix failed')
      }
    },
    onError: () => toast.error('Fix failed'),
  })

  const fixSelected = useMutation({
    mutationFn: () => channelOpsApi.fixSelected(Array.from(selected), slug),
    onSuccess: (res) => {
      if (res?.ok) {
        const contentNote = res.content_improved ? `, ${res.content_improved} with AI-improved tags/description` : ''
        toast.success(`Fixed ${res.fixed ?? 0} of ${res.attempted ?? selected.size} selected videos${contentNote}`)
        setSelected(new Set())
        queryClient.invalidateQueries({ queryKey: ['channel-videos', slug] })
      } else {
        toast.error(res?.error ?? 'Bulk fix failed')
      }
    },
    onError: () => toast.error('Bulk fix failed'),
  })

  const allVideos: any[] = Array.isArray(data) ? data : (data?.videos ?? [])
  // Filter to this channel where possible
  const forChannel = allVideos.filter((v: any) => !v.channel_slug || v.channel_slug === slug)

  // Search and paging, because this panel used to render up to 30 rows with nothing to narrow them: roughly
  // 1,400px of table and no statement of what it was for. Ten rows is what fits beside the rail without
  // scrolling past the fold, and the heading below says what the list is and what you can do to it.
  const term = needle.trim().toLowerCase()
  const matches = term
    ? forChannel.filter((v: any) => String(v.title ?? v.topic ?? '').toLowerCase().includes(term))
    : forChannel
  const pageCount = Math.max(1, Math.ceil(matches.length / VIDEOS_PAGE_SIZE))
  // Clamped rather than stored: narrowing the search while on page 3 must not show an empty table.
  const currentPage = Math.min(page, pageCount)
  const pageVideos = matches.slice((currentPage - 1) * VIDEOS_PAGE_SIZE, currentPage * VIDEOS_PAGE_SIZE)

  const fixableIds = pageVideos.map((v: any) => v.youtube_id ?? v.video_id).filter(Boolean)
  const allSelected = fixableIds.length > 0 && fixableIds.every((id: string) => selected.has(id))
  const firstShown = matches.length === 0 ? 0 : (currentPage - 1) * VIDEOS_PAGE_SIZE + 1
  const lastShown = Math.min(currentPage * VIDEOS_PAGE_SIZE, matches.length)

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(fixableIds))
  }
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) return (
    /* Same shape as the loaded panel — toolbar row, then rows — so nothing jumps when the data lands. */
    <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E5E5]">
        <div className="h-3 w-24 bg-[#F5F5F5] rounded animate-pulse" />
        <div className="h-7 w-52 bg-[#F5F5F5] rounded animate-pulse" />
      </div>
      <div className="space-y-1 p-4">
        {Array.from({ length: VIDEOS_PAGE_SIZE }).map((_, i) => (
          <div key={i} className="h-10 bg-[#F5F5F5] rounded animate-pulse" />
        ))}
      </div>
    </div>
  )

  return (
    /* Its own card rather than a `SectionCard`: this panel needs a heading that states what it is *for* and
       a toolbar, and a title-only card cannot carry either. */
    <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
      {/* Toolbar, not a second heading. The tab above already names this section and says what it is for,
          so repeating both here put the same sentence on screen twice within 300px. What is left is the one
          thing the tab bar cannot show — how much of the list you are looking at — beside the search. */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-[#E5E5E5]">
        <p className="text-[12px] text-[#525252] tabular-nums">
          {matches.length > 0
            ? <>{firstShown}–{lastShown} of {matches.length}</>
            : <span className="text-[#A3A3A3]">No videos</span>}
        </p>
        <div className="relative">
          <Search
            size={12}
            strokeWidth={1.5}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A3A3A3] pointer-events-none"
          />
          <input
            type="search"
            value={needle}
            onChange={e => { setNeedle(e.target.value); setPage(1) }}
            placeholder="Search titles…"
            aria-label="Search this channel's videos by title"
            className="h-7 w-52 pl-8 pr-2 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
          />
        </div>
      </div>

      {/* Actions for the selection float over the page instead of sitting in flow above the table. In flow
          the bar pushed the rows down 94px the moment anything was selected, so the row just clicked moved
          out from under the cursor. Primer's ActionBar exists for exactly this: it appears *on* selection
          rather than reflowing the list. The styling stays light so the bar's own controls keep their
          contrast; only the positioning and the shadow are new. */}
      {selected.size > 0 && (
        <div
          role="region"
          aria-label={`Actions for ${selected.size} selected videos`}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-lg border border-[#E5E5E5] bg-white px-4 py-2.5 shadow-lg"
        >
          <span className="text-[11px] font-medium text-[#0A0A0A]">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="h-6 px-2.5 text-[10px] font-medium text-[#525252] hover:text-[#0A0A0A] transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setBulkOpen(open => !open)}
              className="h-6 px-2.5 text-[11px] font-medium border border-[#E5E5E5] rounded hover:border-[#0A0A0A] transition-colors flex items-center gap-1.5"
            >
              <Type size={10} strokeWidth={1.5} />
              Bulk edit ({selected.size})
            </button>
            <button
              onClick={() => fixSelected.mutate()}
              disabled={fixSelected.isPending}
              className="h-6 px-2.5 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {fixSelected.isPending
                ? <Loader2 size={10} strokeWidth={1.5} className="animate-spin" />
                : <Wrench size={10} strokeWidth={1.5} />
              }
              Fix selected ({selected.size})
            </button>
          </div>
        </div>
      )}

      {bulkOpen && selected.size > 0 && (
        <BulkEditPanel
          slug={slug}
          videoIds={Array.from(selected)}
          onClose={() => setBulkOpen(false)}
          onApplied={() => {
            setBulkOpen(false)
            setSelected(new Set())
            queryClient.invalidateQueries({ queryKey: ['channel-videos', slug] })
          }}
        />
      )}

      {matches.length === 0 ? (
        /* Two empty states, not one. A channel with no videos and a search that matched nothing are
           different situations with different next steps, and Primer's empty-state guidance is explicit
           that the copy should say which one you are in. */
        <div className="px-5 py-12 text-center">
          <Video size={22} strokeWidth={1.5} className="mx-auto mb-3 text-[#D4D4D4]" />
          {term ? (
            <>
              <p className="text-[13px] font-medium text-[#0A0A0A]">No videos match “{needle.trim()}”</p>
              <p className="text-[12px] text-[#A3A3A3] mt-1">
                {forChannel.length} video{forChannel.length !== 1 ? 's' : ''} on this channel, none of them
                with that in the title.
              </p>
              <button
                onClick={() => setNeedle('')}
                className="mt-3 h-7 px-3 text-[11px] font-medium border border-[#E5E5E5] rounded hover:border-[#0A0A0A] transition-colors"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="text-[13px] font-medium text-[#0A0A0A]">No videos on this channel yet</p>
              <p className="text-[12px] text-[#A3A3A3] mt-1 max-w-md mx-auto">
                New videos and anything already on YouTube arrive here after an analytics sync, and each one
                can then be fixed in bulk.
              </p>
            </>
          )}
        </div>
      ) : (
        <table className="w-full text-[12px]" data-testid="channel-videos-table">
          <thead>
            <tr className="border-b border-[#E5E5E5]">
              <th scope="col" className="w-9 px-4 py-2.5 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all videos on this page"
                  className="w-3.5 h-3.5 rounded border-[#D4D4D4] accent-[#0A0A0A]"
                />
              </th>
              {['Title', 'Published', 'Views', 'Click-through', 'Status', ''].map((h) => (
                <th
                  key={h}
                  scope="col"
                  title={h === 'Click-through' ? CTR_COLUMN_NOTE : undefined}
                  className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest"
                >{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5F5F5]">
            {pageVideos.map((v: any) => {
              const ytId = v.youtube_id ?? v.video_id
              return (
              <tr key={ytId ?? v.id} className="hover:bg-[#FAFAFA]">
                <td className="px-4 py-2.5">
                  {ytId && (
                    <input
                      type="checkbox"
                      checked={selected.has(ytId)}
                      onChange={() => toggleOne(ytId)}
                      aria-label={`Select ${v.title ?? v.topic ?? ytId}`}
                      className="w-3.5 h-3.5 rounded border-[#D4D4D4] accent-[#0A0A0A]"
                    />
                  )}
                </td>
                <td className="px-4 py-2.5 max-w-[260px]">
                  <p className="text-[#0A0A0A] truncate font-medium">{v.title ?? v.topic ?? '(no title)'}</p>
                  {ytId && (
                    <a
                      href={`https://youtube.com/watch?v=${ytId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#A3A3A3] hover:text-[#0A0A0A] flex items-center gap-0.5 mt-0.5"
                    >
                      {ytId} <ExternalLink size={9} strokeWidth={1.5} />
                    </a>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[#A3A3A3] whitespace-nowrap">
                  {v.published_at ? new Date(v.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                </td>
                <td className="px-4 py-2.5 text-[#525252]">
                  {v.views != null ? Number(v.views).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {v.ctr_percent != null ? (
                    // Date under the number, not just in the tooltip: "as of" is what distinguishes a
                    // lifetime reading from the windowed views column to its left.
                    <span title={ctrTooltip(v)}>
                      <span className="text-[#0A0A0A]">{fmtCtr(v.ctr_percent)}</span>
                      {v.ctr_captured_at && (
                        <span className="block text-[10px] text-[#A3A3A3]">{ctrAsOf(v.ctr_captured_at)}</span>
                      )}
                    </span>
                  ) : (
                    <span
                      className="text-[#A3A3A3]"
                      title="No click-through reading captured for this video. It needs the browser extension and a visit to your own Studio."
                    >—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {v.status ? (
                    <span className={`text-[11px] font-medium ${
                      v.status === 'published' || v.status === 'public' ? 'text-[#16A34A]'
                      : v.status === 'error' ? 'text-[#DC2626]'
                      : v.status === 'private' ? 'text-[#A3A3A3]'
                      : 'text-[#D97706]'
                    }`}>{v.status}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {ytId && (
                    <button
                      onClick={() => fixVideo.mutate(ytId)}
                      disabled={fixVideo.isPending}
                      /* `aria-label`, not just `title`: an icon-only control needs an accessible name, and
                         a tooltip is not one. */
                      aria-label={`Fix SEO for ${v.title ?? v.topic ?? ytId}`}
                      title="Fix SEO"
                      className="h-6 w-6 inline-flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded transition-colors disabled:opacity-40"
                    >
                      <Wrench size={10} strokeWidth={1.5} />
                    </button>
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Paging, in the shape Primer uses: a range summary on the left, the controls on the right, and
          nothing rendered at all when everything already fits on one page. */}
      {matches.length > VIDEOS_PAGE_SIZE && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E5E5E5]">
          <span className="text-[11px] text-[#A3A3A3]">
            Page {currentPage} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="h-7 px-3 text-[11px] font-medium border border-[#E5E5E5] rounded hover:border-[#0A0A0A] disabled:opacity-40 disabled:hover:border-[#E5E5E5] transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              className="h-7 px-3 text-[11px] font-medium border border-[#E5E5E5] rounded hover:border-[#0A0A0A] disabled:opacity-40 disabled:hover:border-[#E5E5E5] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Channel management: reconnect and remove ─────────────────────────────────
// Both actions already had endpoints (POST /{slug}/reset-auth, DELETE /{slug}) but were reachable only from
// the channel *list* -- and "Reconnect" there appears only when the stored auth already looks broken. A
// channel that is merely *wrong* -- revoked scopes, a grant that landed on the wrong Google account, a
// token the status check still calls OK -- therefore had no way out, and removing a channel had no UI at
// all. This is the panel that fixes that, on the page where you look at one channel.

function ChannelManagementPanel({ slug, channel }: { slug: string; channel: any }) {
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<'reconnect' | 'remove' | null>(null)

  // Admins list every channel on the deployment, so this may belong to someone else.
  const notMine = channel?.is_mine === false

  async function reconnect() {
    setBusy('reconnect')
    try {
      const data = await channelsApi.resetAuth(slug)
      if (data?.requires_oauth && data?.oauth_url) {
        const ok = await openOAuthPopup(data.oauth_url)
        toast.addToast(ok ? 'Channel reconnected' : 'Reconnect cancelled', ok ? 'success' : 'error')
      } else {
        toast.addToast('Channel reconnected', 'success')
      }
      qc.invalidateQueries({ queryKey: ['channels'] })
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Reconnect failed'))
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    const who = channel?.owner_email ? ` (owned by ${channel.owner_email})` : ''
    const ok = window.confirm(
      `Remove ${slug}${who}?\n\n` +
      `This deletes the channel, its stored OAuth token and its settings for that account. ` +
      `Videos already on YouTube are not touched.`
    )
    if (!ok) return
    setBusy('remove')
    try {
      await channelsApi.remove(slug)
      toast.success('Channel removed')
      qc.invalidateQueries({ queryKey: ['channels'] })
      navigate('/app/channels')
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Remove failed'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <SectionCard title="Channel Management">
      <div className="px-5 py-3.5 space-y-3">
        {notMine && (
          <p className="text-[11px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded px-2.5 py-2">
            This channel belongs to {channel?.owner_email || 'another account'}. You can see it because you
            are an admin — removing or reconnecting it affects that account, not yours.
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#0A0A0A]">Reconnect</p>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">
              Run the Google consent flow again and replace the stored token. Use this when a channel's auth
              is revoked, or was granted to the wrong Google account.
            </p>
          </div>
          <button
            onClick={reconnect}
            disabled={busy !== null}
            className="h-7 px-3 text-[11px] font-medium border border-[#E5E5E5] rounded hover:border-[#0A0A0A] transition-colors disabled:opacity-40 shrink-0 flex items-center gap-1.5"
          >
            <RotateCcw size={11} strokeWidth={1.5} />
            {busy === 'reconnect' ? 'Opening…' : 'Reconnect'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#F5F5F5] pt-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#BE123C]">Remove channel</p>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">
              Deletes the channel, its token and its settings. Videos already uploaded stay on YouTube.
            </p>
          </div>
          <button
            onClick={remove}
            disabled={busy !== null}
            className="h-7 px-3 text-[11px] font-medium text-white bg-[#BE123C] rounded hover:bg-[#9F1239] transition-colors disabled:opacity-40 shrink-0 flex items-center gap-1.5"
          >
            <Trash2 size={11} strokeWidth={1.5} />
            {busy === 'remove' ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </SectionCard>
  )
}


/**
 * The channel page's sections, in the shape Primer calls **UnderlineNav**: tabs that change the URL.
 *
 * URL-backed rather than self-hosted panels, and Primer is explicit about the distinction — use the in-page
 * variant for related panels switched between inside one context, the URL variant when the tab is a
 * *destination*. This is a destination: a creator working on discoverability should be able to bookmark the
 * SEO view, share it, refresh into it, and get back to it with the browser's back button.
 *
 * `blurb` is not decoration. This page previously stacked twelve panels whose headings named themselves and
 * nothing that said what the page was *for*; a tab labelled only "SEO" would repeat that one level up, so
 * each states its purpose in a sentence.
 *
 * Tabs also stop the other panels mounting and querying on load. Previously all twelve fired the moment the
 * page opened — several of them against the YouTube API — so switching tabs is the difference between one
 * panel's requests and a dozen.
 */
const CHANNEL_TABS = [
  {
    id: 'videos',
    label: 'Videos',
    blurb: 'Everything published on this channel, with the numbers that matter. Select any to fix titles, descriptions and tags together.',
  },
  {
    id: 'seo',
    label: 'SEO',
    blurb: 'How discoverable the channel is: the audit checklist, the keyword clusters worth targeting, and where you rank for them.',
  },
  {
    id: 'growth',
    label: 'Growth',
    blurb: 'What to do next — an AI read on your own performance data, how you compare with a channel you name, and who to collaborate with.',
  },
  {
    id: 'setup',
    label: 'Setup',
    blurb: 'How this channel produces videos, and the access and branding it publishes under.',
  },
] as const

export default function ChannelDetailPage() {
  const { slug, tab } = useParams<{ slug: string; tab?: string }>()
  const { data: channels = [], isLoading: channelsLoading } = useChannels()

  const channel = (channels as any[]).find((c: any) => c.slug === slug)
  // An unknown segment renders the first tab rather than nothing: a 404 would be pedantic about a stale
  // bookmark, and the fallback is the tab the page opens on anyway.
  const activeTab = CHANNEL_TABS.find(t => t.id === tab) ?? CHANNEL_TABS[0]

  // Same queryKey as AuditPanel's audit query below -- React Query dedupes this,
  // so reading live YouTube subscriber/video/view stats here costs zero extra
  // network calls. The /api/channels list endpoint is purely local registry data
  // (slug/name/auth status) and never fetches YouTube stats -- audit_channel()
  // already does, on this same page, so reuse it instead of adding a new call.
  const { data: auditData } = useQuery({
    queryKey: ['channel-audit', slug],
    queryFn: () => channelOpsApi.audit(slug!),
    enabled: !!slug,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const auditChannelInfo = auditData?.channel

  // One-click sync from the channel page. It writes performance rows (and discovers uploads the pipeline
  // never recorded), so it invalidates the audit -- which is where the live counts come from -- and the
  // dashboard's fleet panel.
  const toast = useToast()
  const queryClient = useQueryClient()
  const syncAnalytics = useMutation({
    mutationFn: () => analyticsApi.sync(slug!),
    onSuccess: (r) => {
      const synced = r?.synced ?? 0
      toast.success(`Analytics synced — ${synced} video${synced === 1 ? '' : 's'} updated`)
      queryClient.invalidateQueries({ queryKey: ['channel-audit', slug] })
      queryClient.invalidateQueries({ queryKey: ['fleet-health'] })
    },
    onError: () => toast.error('Sync failed — check this channel’s YouTube token'),
  })

  if (!slug) return null

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="px-8 pt-8 pb-5">
        <Link
          to="/app/channels"
          className="inline-flex items-center gap-1 text-[12px] text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors mb-4"
        >
          <ChevronLeft size={13} strokeWidth={1.5} /> Channels
        </Link>
        <div className="flex items-start justify-between">
          <div>
            {/* The registry query is local and usually fast, but when it is slow the fallback use to be
                the bare slug — so the page opened with "doodledashtv" as its heading and then swapped to
                "Doodle Dash TV". A placeholder holds the line instead. The slug still appears once the
                query has settled without a match (an admin looking at a channel that is not in their
                scope), because a placeholder forever is worse than a technical name. */}
            <h1 className="text-xl font-semibold text-[#0A0A0A]">
              {channel?.name ?? (channelsLoading
                ? <span className="inline-block h-6 w-44 bg-[#F5F5F5] rounded animate-pulse align-middle" aria-hidden />
                : slug)}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <code className="text-[11px] text-[#A3A3A3] bg-[#F5F5F5] px-2 py-0.5 rounded">{slug}</code>
              {channel?.handle && (
                <span className="text-[12px] text-[#A3A3A3]">{channel.handle}</span>
              )}
              {channel?.channel_id && (
                <a
                  href={`https://youtube.com/channel/${channel.channel_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#A3A3A3] hover:text-[#0A0A0A] flex items-center gap-1 transition-colors"
                >
                  YouTube <ExternalLink size={10} strokeWidth={1.5} />
                </a>
              )}
            </div>
          </div>

          {/* Stats chips + the one action that makes them current */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => syncAnalytics.mutate()}
              disabled={syncAnalytics.isPending}
              className="h-9 px-3 text-[12px] font-medium bg-white border border-[#E5E5E5] rounded-md hover:border-[#D4D4D4] transition-colors disabled:opacity-40 flex items-center gap-1.5"
              title="Pull the latest views, watch time and retention for this channel"
            >
              <RefreshCw size={12} strokeWidth={1.5} className={syncAnalytics.isPending ? 'animate-spin' : ''} />
              {syncAnalytics.isPending ? 'Syncing…' : 'Sync analytics'}
            </button>

            {channel && (
              <div className="flex items-center gap-5 bg-white border border-[#E5E5E5] rounded-md px-5 py-3">
                {[
                  ['Subscribers', auditChannelInfo?.subscriber_count != null ? Number(auditChannelInfo.subscriber_count).toLocaleString() : '—'],
                  ['Videos', auditChannelInfo?.video_count != null ? Number(auditChannelInfo.video_count).toLocaleString() : '—'],
                  ['Views', auditChannelInfo?.view_count != null ? Number(auditChannelInfo.view_count).toLocaleString() : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="text-center">
                    <p className="text-[14px] font-semibold text-[#0A0A0A] leading-none">{value}</p>
                    <p className="text-[10px] text-[#A3A3A3] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sections. A `<nav>` of links rather than a `role="tablist"`: these change the URL, so the correct
          semantics are navigation with `aria-current`, not a tab widget that would promise an in-page
          swap it does not perform. */}
      <nav aria-label="Channel sections" className="px-8 border-b border-[#E5E5E5]">
        <ul className="flex items-center gap-6 -mb-px">
          {CHANNEL_TABS.map(t => {
            const isActive = t.id === activeTab.id
            return (
              <li key={t.id}>
                <Link
                  to={`/app/channels/${slug}/${t.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-block py-3 text-[13px] border-b-2 transition-colors ${
                    isActive
                      ? 'border-[#0A0A0A] text-[#0A0A0A] font-medium'
                      : 'border-transparent text-[#525252] hover:text-[#0A0A0A] hover:border-[#D4D4D4]'
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-8 py-6">
        {/* What this tab is for, said once, above its panels. */}
        <p className="text-[12px] text-[#A3A3A3] max-w-3xl mb-5">{activeTab.blurb}</p>

        {activeTab.id === 'videos' && <VideosPanel slug={slug} />}

        {activeTab.id === 'seo' && (
          <div className="grid gap-5 xl:grid-cols-2 items-start">
            <AuditPanel slug={slug} />
            <KeywordClustersPanel slug={slug} />
            <RankTrackingPanel slug={slug} />
          </div>
        )}

        {activeTab.id === 'growth' && (
          <div className="grid gap-5 xl:grid-cols-2 items-start">
            <AICoachPanel slug={slug} />
            <BenchmarkPanel slug={slug} />
            <CollabPanel slug={slug} />
          </div>
        )}

        {activeTab.id === 'setup' && (
          /* Two explicit columns, not a uniform grid. A grid paired the 784px Video Defaults panel with the
             312px Branding panel and left a 472px hole under Branding; stacking the three short panels
             opposite the tall one gives 784 against ~800. */
          <div className="grid gap-5 xl:grid-cols-2 items-start">
            <VideoDefaultsPanel key={slug} slug={slug} />
            <div className="space-y-5">
              <BrandingPanel slug={slug} channel={channel} />
              <OAuthDiagnosticsPanel />
              <ChannelManagementPanel slug={slug} channel={channel} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
