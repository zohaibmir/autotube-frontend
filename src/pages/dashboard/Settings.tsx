import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ExternalLink, Trash2, RefreshCw, Play, Square, RotateCw, Mic, Check, ChevronRight, Mail, SendHorizonal, LogOut, AlertTriangle, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useByokStatus, useByokSave, useByokRemove, useChannels } from '@hooks/useJobs'
import { useToast } from '@components/Toast'
import { useAuthStore } from '@store/auth'
import { byokApi, publicApi, socialApi, schedulerApi, automationApi, voiceApi, notificationsApi, accountApi, billingApi, settingsApi, type ScriptModelChoice, type VoiceEntry, type VoiceGroup, type NotificationPrefs } from '@api/services'
import apiClient from '@api/client'
import { apiErrorMessage } from '@lib/apiError'
import { pingExtension, linkExtension, linkFailureMessage } from '@lib/extension'
import { API_KEY_GUIDES, STAGE_LABELS, formatProviderCost, hostedStages, type ProviderCost } from '@content/apiKeyGuides'
import { UNIT_CREDITS } from '@lib/creditCosts'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'api-keys' | 'voices' | 'social' | 'scheduler' | 'automation' | 'integrations' | 'preferences' | 'notifications' | 'account'

const TABS: { id: Tab; label: string }[] = [
  { id: 'api-keys',    label: 'API Keys' },
  { id: 'voices',      label: 'Voices' },
  { id: 'social',      label: 'Social Accounts' },
  { id: 'scheduler',   label: 'Scheduler' },
  { id: 'automation',  label: 'Automation' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'account',     label: 'Account' },
]

// Platform-wide tabs: their Save posts to /api/settings/sync-env, which rewrites the deployment's .env
// (SCHEDULER_CHANNEL, TTS_PROVIDER, provider keys) for every account -- not the caller's own settings.
// Reading them is per-user (GET /api/settings), so they never round-tripped either. Admin-only.
// "Scheduler" is NOT in here any more: its schedule now lives per account (GET/PUT
// /api/scheduler/schedule) and has no .env write at all.
const PLATFORM_TABS: Tab[] = ['automation']

const DAY_LABELS: Array<{ id: string; label: string }> = [
  { id: 'mon', label: 'Mon' }, { id: 'tue', label: 'Tue' }, { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' }, { id: 'fri', label: 'Fri' }, { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
]

// The user's own zone plus the IANA list when the browser exposes it (Chrome 99+, Safari 15.4+).
const TIMEZONES: string[] = (() => {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  let list: string[] = []
  try {
    list = typeof intl.supportedValuesOf === 'function' ? intl.supportedValuesOf('timeZone') : []
  } catch { list = [] }
  if (!list.length) {
    list = ['UTC', 'America/Toronto', 'America/New_York', 'America/Chicago', 'America/Denver',
            'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
            'Asia/Karachi', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney']
  }
  const local = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return '' } })()
  return Array.from(new Set(['UTC', ...(local ? [local] : []), ...list])).sort()
})()


// ─── BYOK service definitions ─────────────────────────────────────────────────

// Guide content (steps, caveats, console links) is shared with /guides/api-keys.
const SERVICES = API_KEY_GUIDES.map(g => ({ ...g, docUrl: g.consoleUrl }))

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

function ServiceRow({
  service,
  isSet,
  cost,
  onSave,
  onRemove,
}: {
  service: typeof SERVICES[0]
  isSet: boolean
  cost?: ProviderCost
  onSave: (key: string) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean | null; message: string } | null>(null)
  const costLine = formatProviderCost(cost)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await byokApi.test(service.id))
    } catch (err) {
      setTestResult({ ok: null, message: apiErrorMessage(err, 'Could not test the key') })
    } finally {
      setTesting(false)
    }
  }

  const [expanded, setExpanded] = useState(false)
  const [value, setValue]       = useState('')
  const [show, setShow]         = useState(false)
  const [saving, setSaving]     = useState(false)
  const [removing, setRemoving] = useState(false)

  const handleSave = async () => {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(value.trim())
      setValue('')
      setExpanded(false)
      setShow(false)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await onRemove()
      setExpanded(false)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="border-b border-[#E5E5E5] last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-[#FAFAFA] transition-colors"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isSet ? 'bg-[#16A34A]' : 'bg-[#D4D4D4]'}`} />
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-medium text-[#0A0A0A]">{service.name}</span>
          <span className="text-[12px] text-[#A3A3A3] ml-2">{service.description}</span>
        </div>
        <span className={`text-[11px] font-medium flex-shrink-0 ${isSet ? 'text-[#16A34A]' : 'text-[#A3A3A3]'}`}>
          {isSet ? 'Connected' : 'Not set'}
        </span>
        <span className={`text-[#A3A3A3] text-[11px] ml-1 transition-transform inline-block ${expanded ? 'rotate-90' : ''}`}>›</span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 bg-[#FAFAFA] border-t border-[#E5E5E5]">
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1">
              <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={isSet ? '••••••••••••••••' : service.placeholder}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full h-8 pl-3 pr-9 text-[12px] font-mono bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
              />
              <button
                type="button"
                aria-label={show ? 'Hide API key' : 'Show API key'}
                onClick={() => setShow(!show)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#525252]"
                tabIndex={-1}
              >
                {show ? <EyeOff size={12} strokeWidth={1.5} /> : <Eye size={12} strokeWidth={1.5} />}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !value.trim()}
              className="h-8 px-3 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              {saving && <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />}
              Save
            </button>
            {isSet && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="h-8 px-2.5 text-[12px] font-medium text-[#525252] border border-[#E5E5E5] bg-white rounded hover:border-[#D4D4D4] transition-colors disabled:opacity-40"
              >
                {testing ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : 'Test key'}
              </button>
            )}
            {isSet && (
              <button
                onClick={handleRemove}
                disabled={removing}
                className="h-8 px-2.5 text-[12px] font-medium text-[#DC2626] border border-[#FECACA] rounded hover:bg-[#FEF2F2] transition-colors disabled:opacity-40"
              >
                {removing ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : 'Remove'}
              </button>
            )}
            <a
              href={service.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Get ${service.name} key`}
              className="h-8 w-8 flex items-center justify-center text-[#A3A3A3] hover:text-[#525252] border border-[#E5E5E5] rounded bg-white transition-colors"
            >
              <ExternalLink size={12} strokeWidth={1.5} />
            </a>
          </div>
          {testResult && (
            <p className={`text-[11px] mt-2 ${testResult.ok === true ? 'text-[#16A34A]' : testResult.ok === false ? 'text-[#DC2626]' : 'text-[#B45309]'}`}>
              {testResult.message}
            </p>
          )}
          {costLine && <p className="text-[11px] text-[#525252] mt-2">{costLine}, billed by {service.name} to you.</p>}
          {!isSet && (
            <ol className="text-[11px] text-[#525252] mt-2 space-y-0.5 list-decimal pl-4">
              {service.steps.map(step => <li key={step}>{step}</li>)}
            </ol>
          )}
          {service.caveats.map(c => (
            <p key={c} className="text-[11px] text-[#A3A3A3] mt-1">Note: {c}</p>
          ))}
          <p className="text-[11px] text-[#A3A3A3] mt-2">
            Open the{' '}
            <a href={service.docUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#525252]">
              {service.docUrl.replace('https://', '').split('/')[0]} console
            </a>
            {' '}· <Link to="/guides/api-keys" className="underline hover:text-[#525252]">full guide</Link>
          </p>
        </div>
      )}
    </div>
  )
}

function APIKeysTab() {
  const toast = useToast()
  const { data: status = {}, isLoading } = useByokStatus()
  const saveMutation   = useByokSave()
  const removeMutation = useByokRemove()

  // Only count the services shown in this UI - `status` also includes
  // `kling_secret` (a paired credential, not its own visible row), which was
  // previously included in this count and could make it appear that all
  // services were connected even when one (e.g. Mureka) was actually "Not set".
  const connectedCount = SERVICES.filter((s) => (status as Record<string, boolean>)[s.id]).length
  const { data: costs } = useQuery({
    queryKey: ['api-key-costs'],
    queryFn: () => publicApi.apiKeyCosts(),
    staleTime: 60 * 60_000,
    retry: false,
  })
  const { data: usage } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    staleTime: 30_000,
    retry: false,
  })
  const plan = usage?.plan
  const stillHosted = hostedStages(status as Record<string, boolean>)

  const handleSave = async (serviceId: string, key: string) => {
    try {
      await saveMutation.mutateAsync({ service: serviceId, key })
      toast.success(`${SERVICES.find(s => s.id === serviceId)?.name} key saved`)
    } catch {
      toast.error('Failed to save - check the key is valid')
      throw new Error('save failed')
    }
  }

  const handleRemove = async (serviceId: string) => {
    try {
      await removeMutation.mutateAsync(serviceId)
      toast.success(`${SERVICES.find(s => s.id === serviceId)?.name} key removed`)
    } catch {
      toast.error('Failed to remove key')
      throw new Error('remove failed')
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold text-[#0A0A0A]">Service API Keys</h2>
        <p className="text-[12px] text-[#525252] mt-1">
          Your keys are encrypted and never exposed.{' '}
          {connectedCount > 0 && (
            <span className="text-[#16A34A]">{connectedCount} of {SERVICES.length} connected.</span>
          )}
        </p>
      </div>
      {isLoading ? (
        <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
          {SERVICES.map((s) => (
            <div key={s.id} className="h-12 border-b border-[#E5E5E5] last:border-b-0 px-5 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#F5F5F5] animate-pulse" />
              <div className="w-40 h-3 bg-[#F5F5F5] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
          {SERVICES.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              isSet={!!(status as Record<string, boolean>)[service.id]}
              cost={costs?.providers?.[service.id]}
              onSave={(key) => handleSave(service.id, key)}
              onRemove={() => handleRemove(service.id)}
            />
          ))}
        </div>
      )}
      {!isLoading && (
        <div className="mt-3 px-4 py-3 border border-[#E5E5E5] rounded-lg bg-[#FAFAFA] text-[12px] text-[#525252]">
          <span className="font-medium text-[#0A0A0A]">What you still pay us for: </span>
          {plan === 'free'
            ? 'Free runs on our keys only. Own keys need a paid plan, including the Own Keys plan.'
            : <>
                {stillHosted.length === 0
                  ? 'nothing per provider: every paid stage runs on your keys. Stock footage and the standard voice are free.'
                  : `${stillHosted.map(s => STAGE_LABELS[s]).join(', ')} run on our keys and are charged in credits. Stock footage and the standard voice are free.`}
                {plan === 'starter' && ` Starter adds a ${UNIT_CREDITS.byokPlatformFee}-credit platform fee to each run on your keys.`}
                {plan === 'own_keys' && stillHosted.length > 0 && ' On Own Keys those stages draw on top-up credits.'}
              </>}
        </div>
      )}
    </div>
  )
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────
// This tab used to have fake "Connect"/"Disconnect" buttons that only toggled
// local React state with zero backend wiring - clicking "Disconnect" on
// Supabase (which the entire app runs on) did nothing but looked like it
// worked. These are platform-level infrastructure integrations, not something
// an end user can toggle from Settings, so this is now a read-only status
// display. YouTube's status reflects whether at least one channel currently
// has a working OAuth token.

const STATIC_INTEGRATIONS = [
  { id: 'r2',       name: 'Cloudflare R2', description: 'Video storage and CDN' },
  { id: 'supabase', name: 'Supabase',      description: 'Auth and database' },
]

// ─── Browser extension (COMPETITOR_FEATURES_AI_STRATEGY.md 2.9, phase 3) ──────
//
// The extension reads impressions and click-through out of YouTube Studio's own
// analytics view -- the one figure Google's API refuses to serve (HTTP 400 "The
// query is not supported") -- and posts them here, so a thumbnail change can be
// judged against the video's own past.
//
// The token below authorises that POST. It is scoped to the extension endpoints
// only, shown exactly once, stored as a hash, and revocable on its own without
// touching the user's session. That is why it exists instead of reusing the
// session JWT (which expires hourly) or a refresh token (a full-account
// credential a browser extension has no business holding).

type ExtensionToken = {
  id: number
  label: string | null
  created_at: string | null
  last_used_at: string | null
  revoked_at: string | null
}

function BrowserExtensionPanel() {
  const toast = useToast()
  const [label, setLabel]   = useState('')
  const [minted, setMinted] = useState('')
  const [busy, setBusy]     = useState(false)
  const [tokens, setTokens] = useState<ExtensionToken[]>([])
  const [linking, setLinking] = useState(false)
  // null = still checking. Checked once on mount so the panel offers the action that can actually
  // work, rather than a button that fails for anyone without the extension.
  const [extInstalled, setExtInstalled] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    pingExtension().then((yes) => { if (alive) setExtInstalled(yes) })
    return () => { alive = false }
  }, [])

  const loadTokens = async () => {
    try {
      const { data } = await apiClient.get('/api/extension/tokens')
      setTokens(Array.isArray(data?.tokens) ? data.tokens : [])
    } catch {
      // A failed listing is not worth an error toast: it renders as "no active
      // tokens", and creating one still works.
      setTokens([])
    }
  }

  useEffect(() => { void loadTokens() }, [])

  /**
   * Mint a token and hand it straight to the extension.
   *
   * This is the whole point of the button: a paying customer should never have to move a `vdx_…`
   * string between two UIs by hand. If the handover fails the token is still shown, because the
   * manual path below is a real fallback rather than a broken state.
   */
  const connect = async () => {
    setLinking(true)
    try {
      const { data } = await apiClient.post('/api/extension/token', {
        label: 'Connected from the dashboard',
      })
      const token = String(data?.token || '')
      if (!token) throw new Error('no token returned')

      const res = await linkExtension(token)
      if (res.ok) {
        setMinted('')
        toast.success('The extension is connected to this account')
      } else {
        setMinted(token)
        toast.error(linkFailureMessage(res.error))
      }
      await loadTokens()
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not create a token'))
    } finally {
      setLinking(false)
    }
  }

  const mint = async () => {
    setBusy(true)
    try {
      const { data } = await apiClient.post('/api/extension/token', { label: label.trim() || null })
      setMinted(String(data?.token || ''))
      setLabel('')
      await loadTokens()
      toast.success('Token created - copy it now')
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not create a token'))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: number) => {
    try {
      await apiClient.delete(`/api/extension/tokens/${id}`)
      await loadTokens()
      toast.success('Token revoked')
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not revoke that token'))
    }
  }

  const live = tokens.filter((t) => !t.revoked_at)

  return (
    <div className="mt-8">
      <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Browser extension</h2>
      <p className="text-[12px] text-[#525252] mb-4">
        Create a token, then paste it into the Vidora extension's Options page. It lets the extension
        save the impressions and click-through figures it reads from your own YouTube Studio view.
        Revoke it any time — the extension stops working immediately.
      </p>

      <div className="border border-[#E5E5E5] rounded-lg bg-white p-5">
        {/* The one-click path. The manual token below still exists, because a browser without the
            extension installed -- or a build whose id is not configured -- has no other way. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-4 mb-4 border-b border-[#F5F5F5]">
          <div className="flex-1">
            <p className="text-[12px] font-medium text-[#0A0A0A]">
              {extInstalled === null
                ? 'Checking for the extension…'
                : extInstalled
                  ? 'Extension detected in this browser'
                  : 'Extension not detected in this browser'}
            </p>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">
              {extInstalled === true
                ? 'Connect it and it starts working — no copying or pasting.'
                : extInstalled === false
                  ? 'Install the Vidora extension, then reload this page. The token below works either way.'
                  : 'One moment.'}
            </p>
          </div>
          <button
            type="button"
            onClick={connect}
            disabled={linking || extInstalled !== true}
            className="h-9 px-4 rounded bg-[#0A0A0A] text-white text-[12px] font-medium hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 flex-shrink-0"
          >
            {linking ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> : null}
            Connect the extension
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <label htmlFor="ext-label" className="block text-[11px] font-medium text-[#525252] mb-1.5">
              Label (optional)
            </label>
            <input
              id="ext-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. work laptop"
              maxLength={120}
              className="w-full h-9 px-3 rounded border border-[#E5E5E5] text-[13px] text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>
          <button
            type="button"
            onClick={mint}
            disabled={busy}
            className="h-9 px-4 rounded bg-[#0A0A0A] text-white text-[12px] font-medium hover:bg-[#262626] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> : null}
            Create token
          </button>
        </div>

        {minted ? (
          <div className="mt-4 rounded border border-[#E5E5E5] bg-[#FAFAFA] p-3">
            <p className="text-[11px] font-medium text-[#0A0A0A] mb-1.5">
              Copy this now — it cannot be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono text-[#0A0A0A] break-all">{minted}</code>
              <button
                type="button"
                onClick={() => { void navigator.clipboard.writeText(minted); toast.success('Copied') }}
                className="flex-shrink-0 text-[11px] font-medium h-7 px-2.5 rounded border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <p className="text-[11px] font-medium text-[#525252] mb-2">
            {live.length ? `Active tokens (${live.length})` : 'No active tokens'}
          </p>
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2 border-t border-[#F5F5F5]">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#0A0A0A] truncate">{t.label || 'Unnamed token'}</p>
                <p className="text-[11px] text-[#A3A3A3]">
                  {t.revoked_at
                    ? 'Revoked'
                    : t.last_used_at ? `Last used ${t.last_used_at}` : 'Never used'}
                </p>
              </div>
              {!t.revoked_at ? (
                <button
                  type="button"
                  onClick={() => revoke(t.id)}
                  className="flex-shrink-0 text-[11px] font-medium text-[#B42318] hover:underline"
                >
                  Revoke
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function IntegrationsTab() {
  const { data: channels = [] } = useChannels()
  const youtubeConnected = (channels as any[]).some((ch) => ch.auth_status === 'ok')

  const rows = [
    { id: 'youtube', name: 'YouTube', description: 'Upload and manage videos', connected: youtubeConnected },
    ...STATIC_INTEGRATIONS.map((i) => ({ ...i, connected: true })),
  ]

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Integrations</h2>
      <p className="text-[12px] text-[#525252] mb-5">Connected platforms and infrastructure (read-only status).</p>
      <div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
        {rows.map((int) => (
          <div key={int.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#E5E5E5] last:border-b-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${int.connected ? 'bg-[#16A34A]' : 'bg-[#D4D4D4]'}`} />
            <div className="flex-1">
              <p className="text-[13px] font-medium text-[#0A0A0A]">{int.name}</p>
              <p className="text-[11px] text-[#A3A3A3]">{int.description}</p>
            </div>
            <span className={`text-[11px] font-medium ${int.connected ? 'text-[#16A34A]' : 'text-[#A3A3A3]'}`}>
              {int.connected ? 'Connected' : 'Not connected'}
            </span>
            {int.id === 'youtube' && !int.connected && (
              <Link to="/app/channels"
                    className="text-[11px] font-medium h-7 px-2.5 rounded border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors flex items-center">
                Manage in Channels →
              </Link>
            )}
          </div>
        ))}
      </div>

      <BrowserExtensionPanel />
    </div>
  )
}

// ─── Preferences Tab ──────────────────────────────────────────────────────────

const PROVIDER_NAMES: Record<string, string> = { anthropic: 'Claude (Anthropic)', openai: 'OpenAI', gemini: 'Google Gemini' }

function creditsDeltaText(delta: number): string {
  if (!delta) return 'included'
  return delta > 0 ? `+${delta} credits / episode` : `${delta} credits / episode`
}

// The account's script model (PRICING_STRATEGY.md §6.11). The server decides what actually runs -- the plan may
// not include the choice, or the chosen provider may have no key -- and this panel shows that rather than
// implying the selection won.
function ScriptModelPanel() {
  const toast = useToast()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['script-model'], queryFn: settingsApi.getScriptModel })
  const save = useMutation({
    mutationFn: (model: string) => settingsApi.putScriptModel(model),
    onSuccess: (next) => {
      qc.setQueryData(['script-model'], next)
      toast.success('Script model saved')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save the script model')),
  })

  if (isLoading || !data) {
    return <div className="border border-[#E5E5E5] rounded-md bg-white p-5 mb-5 text-[12px] text-[#A3A3A3]">Loading script models…</div>
  }

  const byProvider = data.choices.reduce<Record<string, ScriptModelChoice[]>>((acc, c) => {
    (acc[c.provider] ||= []).push(c)
    return acc
  }, {})
  const labelOf = (id: string) => data.choices.find((c) => c.model === id)?.label ?? id
  const current = data.allowed ? (data.selected ?? '') : ''

  return (
    <div className="border border-[#E5E5E5] rounded-md bg-white overflow-hidden mb-5">
      <div className="px-5 py-2.5 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#0A0A0A]">Script model</p>
        {!data.allowed && (
          <Link to="/pricing" className="text-[11px] font-medium text-[#1D4ED8] hover:underline">Paid plans only — upgrade</Link>
        )}
      </div>
      <div className="px-5 py-4">
        <p className="text-[12px] text-[#525252] mb-3">
          Which AI writes your scripts. Premium models write richer scripts and cost a few more credits per
          episode; with your own key for that provider there is no extra charge.
        </p>
        <label className="flex items-start gap-2.5 py-1.5 cursor-pointer">
          <input
            type="radio"
            name="script-model"
            className="mt-0.5"
            checked={current === ''}
            disabled={save.isPending}
            onChange={() => save.mutate('')}
          />
          <span className="text-[13px] text-[#0A0A0A]">
            System default <span className="text-[#A3A3A3]">— {labelOf(data.system_default)}, included in the plan price</span>
          </span>
        </label>
        {Object.entries(byProvider).map(([provider, rows]) => (
          <div key={provider} className="mt-2">
            <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">{PROVIDER_NAMES[provider] ?? provider}</p>
            {rows.map((c) => (
              <label key={c.model} className={`flex items-start gap-2.5 py-1.5 ${data.allowed ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                <input
                  type="radio"
                  name="script-model"
                  className="mt-0.5"
                  checked={current === c.model}
                  disabled={!data.allowed || save.isPending}
                  onChange={() => save.mutate(c.model)}
                />
                <span className="text-[13px] text-[#0A0A0A]">
                  {c.label}
                  <span className="ml-1.5 text-[10px] uppercase tracking-wide text-[#737373] border border-[#E5E5E5] rounded px-1">{c.tier}</span>
                  <span className="block text-[11px] text-[#737373]">
                    {c.funded_by === 'byok'
                      ? 'Your key — no extra credits'
                      : c.funded_by === 'platform'
                        ? creditsDeltaText(c.credits_delta_longform)
                        : `Needs a ${PROVIDER_NAMES[c.provider] ?? c.provider} key in API Keys`}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ))}
        {data.ignored === 'plan' && data.selected && (
          <p className="text-[11px] text-[#B45309] mt-3">
            Your plan uses the system default, so your saved choice ({labelOf(data.selected)}) is not applied.
          </p>
        )}
        {data.fallback && (
          <p className="text-[11px] text-[#B45309] mt-3">
            Your choice can't run right now ({data.fallback}), so scripts use {labelOf(data.effective)}. Add the key
            in API Keys to use it.
          </p>
        )}
        {!data.fallback && !data.ignored && (
          <p className="text-[11px] text-[#A3A3A3] mt-3">Scripts are currently written with {labelOf(data.effective)}.</p>
        )}
      </div>
    </div>
  )
}

function PreferencesTab() {
  // This tab's notification toggles duplicate NotificationsTab (which has real
  // API persistence). Route users there instead of silently swallowing changes.
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Preferences</h2>
      <p className="text-[12px] text-[#525252] mb-5">AI model and notification settings.</p>
      <ScriptModelPanel />
      <div className="flex gap-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-md p-4 mb-4">
        <div>
          <p className="text-[13px] font-semibold text-[#1D4ED8] mb-0.5">Email notifications are in the Notifications tab</p>
          <p className="text-[12px] text-[#525252]">
            Configure job-completion emails, SMTP settings, and test delivery in{' '}
            <button
              className="text-[#1D4ED8] underline"
              onClick={() => {
                // Find and click the Notifications tab button
                const tabs = document.querySelectorAll('[data-settings-tab]')
                const notifTab = Array.from(tabs).find(
                  (t) => t.textContent?.trim().toLowerCase().includes('notification')
                ) as HTMLButtonElement | undefined
                notifTab?.click()
              }}
            >
              Settings → Notifications
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Social Accounts Tab ─────────────────────────────────────────────────────

type SocialField = {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder: string
  optional?: boolean
}

type SocialPlatformDef = {
  id: string
  label: string
  subtitle: string
  hint: string
  fields: SocialField[]
  comingSoon?: boolean
}

const SOCIAL_PLATFORMS: SocialPlatformDef[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    subtitle: 'Reels + Stories',
    hint: 'https://developers.facebook.com/docs/instagram-api',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'EAABsbCS4R...' },
      { key: 'user_id',      label: 'Instagram Business ID', type: 'text', placeholder: '17841400...', optional: true },
    ],
  },
  {
    id: 'facebook',
    label: 'Facebook',
    subtitle: 'Reels + Stories',
    hint: 'https://developers.facebook.com/docs/pages/access-tokens',
    fields: [
      { key: 'access_token', label: 'Page Access Token', type: 'password', placeholder: 'EAABsbCS4R...' },
      { key: 'page_id',      label: 'Page ID', type: 'text', placeholder: '1234567890', optional: true },
    ],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    subtitle: 'Video posts',
    hint: 'https://developers.tiktok.com/doc/login-kit-web',
    fields: [
      { key: 'access_token',  label: 'Access Token',  type: 'password', placeholder: 'act.example...' },
      { key: 'refresh_token', label: 'Refresh Token', type: 'password', placeholder: 'rft.example...', optional: true },
    ],
  },
  {
    id: 'telegram',
    label: 'Telegram',
    subtitle: 'Channel link posts',
    hint: 'https://core.telegram.org/bots#how-do-i-create-a-bot',
    fields: [
      { key: 'bot_token',  label: 'Bot Token', type: 'password', placeholder: '123456:AABBccDDeeFF...' },
      { key: 'channel_id', label: 'Channel ID or @username', type: 'text', placeholder: '@mychannel or -100123456789' },
    ],
  },
  {
    id: 'reddit',
    label: 'Reddit',
    subtitle: 'YouTube link posts to subreddits',
    hint: 'https://www.reddit.com/prefs/apps',
    fields: [
      { key: 'client_id',     label: 'Client ID',     type: 'text',     placeholder: 'AbCdEfGhI...' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'xYz_secret...' },
      { key: 'username',      label: 'Reddit Username', type: 'text',   placeholder: 'mybotaccount' },
      { key: 'password',      label: 'Password',       type: 'password', placeholder: 'bot account password' },
      { key: 'subreddits',    label: 'Subreddits (comma-separated)', type: 'text', placeholder: 'videos,youtubers,learnprogramming' },
    ],
  },
  {
    id: 'twitter',
    label: 'X (Twitter)',
    subtitle: 'Coming soon - video posts',
    hint: 'https://developer.x.com/en/docs/twitter-api',
    fields: [],
    comingSoon: true,
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    subtitle: 'Coming soon - video pins',
    hint: 'https://developers.pinterest.com/docs/',
    fields: [],
    comingSoon: true,
  },
]

function SocialPlatformRow({
  platform, connected, stats, onSave, onRemove,
}: {
  platform: SocialPlatformDef
  connected: boolean
  stats?: { recent_posts_count?: number; total_views?: number }
  onSave: (config: Record<string, string>) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [fields, setFields]     = useState<Record<string, string>>(
    Object.fromEntries(platform.fields.map((f) => [f.key, '']))
  )
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})
  const [saving, setSaving]   = useState(false)
  const [removing, setRemoving] = useState(false)

  const requiredFields = platform.fields.filter((f) => !f.optional)
  const canSave = requiredFields.every((f) => fields[f.key]?.trim())

  const handleSave = async () => {
    setSaving(true)
    try {
      const config: Record<string, string> = {}
      platform.fields.forEach((f) => { if (fields[f.key]?.trim()) config[f.key] = fields[f.key].trim() })
      await onSave(config)
      setFields(Object.fromEntries(platform.fields.map((f) => [f.key, ''])))
      setExpanded(false)
    } finally { setSaving(false) }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try { await onRemove(); setExpanded(false) }
    finally { setRemoving(false) }
  }

  if (platform.comingSoon) {
    return (
      <div className="border-b border-[#E5E5E5] last:border-b-0 flex items-center gap-3 px-5 py-3.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#E5E5E5]" />
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-medium text-[#A3A3A3]">{platform.label}</span>
          <span className="text-[11px] text-[#D4D4D4] ml-2">{platform.subtitle}</span>
        </div>
        <span className="text-[10px] font-medium text-[#D4D4D4] uppercase tracking-widest">Soon</span>
      </div>
    )
  }

  return (
    <div className="border-b border-[#E5E5E5] last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-[#FAFAFA] transition-colors"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-[#16A34A]' : 'bg-[#D4D4D4]'}`} />
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-medium text-[#0A0A0A]">{platform.label}</span>
          <span className="text-[11px] text-[#A3A3A3] ml-2">{platform.subtitle}</span>
          {connected && stats?.recent_posts_count ? (
            <span className="text-[11px] text-[#A3A3A3] ml-2">
              · {stats.recent_posts_count} posts
              {stats.total_views ? `, ${stats.total_views.toLocaleString()} views` : ''}
            </span>
          ) : null}
        </div>
        <span className={`text-[11px] font-medium flex-shrink-0 ${connected ? 'text-[#16A34A]' : 'text-[#A3A3A3]'}`}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
        <span className={`text-[#A3A3A3] text-[11px] ml-1 transition-transform inline-block ${expanded ? 'rotate-90' : ''}`}>›</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 bg-[#FAFAFA] border-t border-[#E5E5E5]">
          <div className="space-y-2.5 mt-3 max-w-md">
            {platform.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">
                  {field.label}{field.optional && <span className="normal-case tracking-normal font-normal ml-1">(optional)</span>}
                </label>
                {field.type === 'password' ? (
                  <div className="relative">
                    <input
                      type={visibleFields[field.key] ? 'text' : 'password'}
                      value={fields[field.key] ?? ''}
                      onChange={(e) => setFields({ ...fields, [field.key]: e.target.value })}
                      placeholder={connected ? '••••••••' : field.placeholder}
                      className="w-full h-8 pl-3 pr-9 text-[12px] font-mono bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
                    />
                    <button type="button" tabIndex={-1}
                      aria-label={visibleFields[field.key] ? `Hide ${field.label}` : `Show ${field.label}`}
                      onClick={() => setVisibleFields({ ...visibleFields, [field.key]: !visibleFields[field.key] })}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#525252]">
                      {visibleFields[field.key] ? <EyeOff size={12} strokeWidth={1.5} /> : <Eye size={12} strokeWidth={1.5} />}
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={fields[field.key] ?? ''}
                    onChange={(e) => setFields({ ...fields, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full h-8 px-3 text-[12px] font-mono bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="h-8 px-3 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {saving && <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />}
              {connected ? 'Update' : 'Connect'}
            </button>
            {connected && (
              <button
                onClick={handleRemove}
                disabled={removing}
                className="h-8 px-2.5 text-[12px] font-medium text-[#DC2626] border border-[#FECACA] rounded hover:bg-[#FEF2F2] disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {removing ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : <><Trash2 size={11} strokeWidth={1.5} /> Disconnect</>}
              </button>
            )}
            <a href={platform.hint} target="_blank" rel="noopener noreferrer"
              className="h-8 w-8 flex items-center justify-center text-[#A3A3A3] hover:text-[#525252] border border-[#E5E5E5] rounded bg-white transition-colors" title="Docs">
              <ExternalLink size={12} strokeWidth={1.5} />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function SocialAccountsTab() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: channels = [] } = useChannels()
  const [channelSlug, setChannelSlug] = useState<string>('')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['social-status', channelSlug],
    queryFn: () => socialApi.status(channelSlug || undefined),
    staleTime: 30_000,
  })

  const platforms: any[] = data?.platforms ?? []

  const saveConfig = useMutation({
    mutationFn: ({ platformId, config }: { platformId: string; config: Record<string, string> }) =>
      socialApi.saveConfig(platformId, config, channelSlug || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-status', channelSlug] }),
  })

  const removePlatform = useMutation({
    mutationFn: (platformId: string) => socialApi.removePlatform(platformId, channelSlug || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-status', channelSlug] }),
  })

  const getStats = (platformId: string) => {
    const p = platforms.find((pl) => pl.platform?.toLowerCase() === platformId)
    return p ? { recent_posts_count: p.recent_posts_count, total_views: p.total_views } : undefined
  }

  const isConnected = (platformId: string) =>
    platforms.some((p) => p.platform?.toLowerCase() === platformId && p.connected)

  const handleSave = async (platformId: string, config: Record<string, string>) => {
    try {
      await saveConfig.mutateAsync({ platformId, config })
      toast.success(`${SOCIAL_PLATFORMS.find(p => p.id === platformId)?.label} connected`)
    } catch {
      toast.error('Failed to save credentials')
      throw new Error('save failed')
    }
  }

  const handleRemove = async (platformId: string) => {
    try {
      await removePlatform.mutateAsync(platformId)
      toast.success(`${SOCIAL_PLATFORMS.find(p => p.id === platformId)?.label} disconnected`)
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  const activeCount = SOCIAL_PLATFORMS.filter((p) => !p.comingSoon && isConnected(p.id)).length

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-semibold text-[#0A0A0A]">Social Accounts</h2>
          <p className="text-[12px] text-[#525252] mt-1">
            Per-channel distribution. Videos are posted automatically after each YouTube upload.
            {activeCount > 0 && <span className="text-[#16A34A] ml-1">{activeCount} connected.</span>}
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          aria-label="Refresh social accounts"
          className="h-7 w-7 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded bg-white transition-colors disabled:opacity-40 flex-shrink-0" title="Refresh">
          <RefreshCw size={13} strokeWidth={1.5} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Channel selector */}
      <div className="mb-5">
        <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Channel</label>
        <select
          value={channelSlug}
          onChange={(e) => setChannelSlug(e.target.value)}
          className="h-8 pl-3 pr-8 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none max-w-xs"
        >
          <option value="">All channels (global)</option>
          {(channels as any[]).map((ch: any) => (
            <option key={ch.slug || ch.id} value={ch.slug || ch.id}>
              {ch.name || ch.slug || ch.id}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-[#A3A3A3] mt-1">
          Select a channel to configure platform connections specific to it, or leave blank for a global default.
        </p>
      </div>

      {isLoading ? (
        <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
          {SOCIAL_PLATFORMS.filter(p => !p.comingSoon).map((p) => (
            <div key={p.id} className="h-12 border-b border-[#E5E5E5] last:border-b-0 px-5 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#F5F5F5] animate-pulse" />
              <div className="w-32 h-3 bg-[#F5F5F5] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-[#E5E5E5] rounded-md overflow-hidden bg-white">
          {SOCIAL_PLATFORMS.map((platform) => (
            <SocialPlatformRow
              key={platform.id}
              platform={platform}
              connected={isConnected(platform.id)}
              stats={getStats(platform.id)}
              onSave={(config) => handleSave(platform.id, config)}
              onRemove={() => handleRemove(platform.id)}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-[#A3A3A3] mt-4">
        Credentials are stored encrypted (AES-256-GCM). Reddit posts YouTube links only - video upload coming in a future update.
      </p>
    </div>
  )
}

// ─── Scheduler Tab ────────────────────────────────────────────────────────────

function SchedulerTab() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data: statusData, isLoading: statusLoading, refetch } = useQuery({
    queryKey: ['scheduler-status'],
    queryFn: () => schedulerApi.status(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['scheduler-history'],
    queryFn: () => schedulerApi.history(15),
    staleTime: 30_000,
  })

  // This account's own schedule. It used to be the Automation tab's env-backed cadence, which wrote
  // SCHEDULER_PUBLISH_TIME for the whole deployment (and needed a process restart); the runner now reads
  // this per-user row, so a tenant can pick their own time and timezone.
  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['my-schedule'],
    queryFn: () => schedulerApi.getSchedule(),
    staleTime: 30_000,
  })

  const [schedEnabled, setSchedEnabled] = useState(false)
  const [schedTimes, setSchedTimes]     = useState<string[]>(['14:00'])
  const [schedTz, setSchedTz]           = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
  })
  const [schedDays, setSchedDays]       = useState<string[]>(['mon','tue','wed','thu','fri','sat','sun'])
  const [schedPerRun, setSchedPerRun]   = useState(1)
  const [schedDirty, setSchedDirty]     = useState(false)

  React.useEffect(() => {
    const cfg = scheduleData?.schedule
    if (!cfg) return
    setSchedEnabled(cfg.enabled)
    setSchedTimes(cfg.times?.length ? cfg.times : [cfg.time || '14:00'])
    setSchedTz(cfg.timezone || 'UTC')
    setSchedDays(cfg.days?.length ? cfg.days : ['mon','tue','wed','thu','fri','sat','sun'])
    setSchedPerRun(cfg.per_run || 1)
    setSchedDirty(false)
  }, [scheduleData])

  const saveSchedule = useMutation({
    mutationFn: () => schedulerApi.saveSchedule({
      enabled: schedEnabled,
      time: [...schedTimes].sort()[0] || '14:00',
      times: [...schedTimes].sort(),
      timezone: schedTz,
      days: schedDays,
      per_run: schedPerRun,
    }),
    onSuccess: (res) => {
      toast.success(res.next_run_at
        ? `Schedule saved — next run ${new Date(res.next_run_at).toLocaleString()}`
        : 'Schedule saved — disabled, the queue runs on every tick')
      setSchedDirty(false)
      queryClient.invalidateQueries({ queryKey: ['my-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['scheduler-status'] })
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to save schedule')),
  })

  const runNext = useMutation({
    mutationFn: () => schedulerApi.runNext(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-status'] })
      queryClient.invalidateQueries({ queryKey: ['scheduler-history'] })
      toast.success('Job queued - pipeline starting now')
    },
    onError: () => toast.error('Failed to run next job'),
  })

  const testRun = useMutation({
    mutationFn: () => schedulerApi.testRun(),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-status'] })
      queryClient.invalidateQueries({ queryKey: ['scheduler-history'] })
      toast.success(res?.message ?? 'Test run triggered - check Jobs for progress')
    },
    onError: () => toast.error('Test run failed'),
  })

  const s = statusData?.status ?? {}
  const queue = statusData?.queue ?? {}
  const history: any[] = historyData?.history ?? []

  const statusLabel = s.running ? 'Running' : s.active ? 'Active' : 'Paused'
  const statusColor = s.running ? 'text-[#16A34A]' : s.active ? 'text-[#D97706]' : 'text-[#A3A3A3]'
  const statusDot   = s.running ? 'bg-[#16A34A]' : s.active ? 'bg-[#D97706]' : 'bg-[#D4D4D4]'

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Scheduler</h2>
      <p className="text-[12px] text-[#525252] mb-5">
        Automated queue processing. The scheduler dequeues topics and runs the pipeline on a cadence.
      </p>

      {/* This account's publishing schedule */}
      <div className="border border-[#E5E5E5] rounded-md bg-white mb-5 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between">
          <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">My schedule</p>
          {scheduleData?.next_run_at && schedEnabled && (
            <p className="text-[11px] text-[#525252]">
              Next run {new Date(scheduleData.next_run_at).toLocaleString()}
            </p>
          )}
        </div>
        {scheduleLoading ? (
          <div className="px-5 py-4"><div className="w-40 h-3 bg-[#F5F5F5] rounded animate-pulse" /></div>
        ) : (
          <div className="px-5 py-4 space-y-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={schedEnabled}
                onChange={(e) => { setSchedEnabled(e.target.checked); setSchedDirty(true) }}
                className="w-3.5 h-3.5 accent-[#0A0A0A]"
              />
              <span className="text-[12px] text-[#0A0A0A]">
                Run my queue on a schedule
              </span>
              <span className="text-[11px] text-[#A3A3A3]">
                {schedEnabled ? '' : 'off — the queue runs on every scheduler tick'}
              </span>
            </label>

            <div>
              <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">
                Run times ({schedTz})
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {schedTimes.map((t, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input
                      type="time"
                      value={t}
                      disabled={!schedEnabled}
                      onChange={(e) => {
                        const next = [...schedTimes]
                        next[i] = e.target.value
                        setSchedTimes(next)
                        setSchedDirty(true)
                      }}
                      className="h-8 px-3 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors disabled:opacity-40"
                    />
                    {schedTimes.length > 1 && (
                      <button
                        type="button"
                        disabled={!schedEnabled}
                        onClick={() => {
                          setSchedTimes(schedTimes.filter((_, j) => j !== i))
                          setSchedDirty(true)
                        }}
                        title="Remove this time"
                        className="w-6 h-6 flex items-center justify-center text-[#A3A3A3] hover:text-red-600 disabled:opacity-40"
                      >
                        <X size={11} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                ))}
                {schedTimes.length < 6 && (
                  <button
                    type="button"
                    disabled={!schedEnabled}
                    onClick={() => { setSchedTimes([...schedTimes, '18:00']); setSchedDirty(true) }}
                    className="h-8 px-2.5 text-[11px] font-medium text-[#525252] border border-dashed border-[#D4D4D4] rounded hover:border-[#0A0A0A] hover:text-[#0A0A0A] disabled:opacity-40"
                  >
                    + Add time
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[#A3A3A3] mt-1">
                Twice a day? Add a second time. Each time starts {schedPerRun} topic{schedPerRun === 1 ? '' : 's'}.
              </p>
            </div>

            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Timezone</label>
                <select
                  value={schedTz}
                  disabled={!schedEnabled}
                  onChange={(e) => { setSchedTz(e.target.value); setSchedDirty(true) }}
                  className="h-8 pl-3 pr-8 max-w-[220px] text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none disabled:opacity-40"
                >
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Topics per run</label>
                <select
                  value={schedPerRun}
                  disabled={!schedEnabled}
                  onChange={(e) => { setSchedPerRun(Number(e.target.value)); setSchedDirty(true) }}
                  className="h-8 pl-3 pr-8 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none disabled:opacity-40"
                >
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button
                onClick={() => saveSchedule.mutate()}
                disabled={!schedDirty || saveSchedule.isPending}
                className="h-8 px-4 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {saveSchedule.isPending && <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />}
                Save
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Days</label>
              <div className="flex gap-1.5 flex-wrap">
                {DAY_LABELS.map(({ id, label }) => {
                  const on = schedDays.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!schedEnabled}
                      onClick={() => {
                        setSchedDays((days) => on ? days.filter((d) => d !== id) : [...days, id])
                        setSchedDirty(true)
                      }}
                      className={[
                        'h-7 px-2.5 text-[11px] font-medium rounded border transition-colors disabled:opacity-40',
                        on
                          ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                          : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#D4D4D4]',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <p className="text-[11px] text-[#A3A3A3]">
              Your queue starts at {schedTimes.join(', ')} {schedTz}{schedEnabled ? '' : ' when enabled'}, on the days
              selected. This runs the pipeline from the queue; it does not change anything for other
              accounts, and no restart is needed.
            </p>
          </div>
        )}
      </div>


      {/* Status row */}
      <div className="border border-[#E5E5E5] rounded-md bg-white divide-y divide-[#F5F5F5] mb-5">
        {statusLoading ? (
          <div className="px-5 py-4 flex gap-3 items-center">
            <div className="w-24 h-3 bg-[#F5F5F5] rounded animate-pulse" />
            <div className="w-40 h-3 bg-[#F5F5F5] rounded animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot} ${s.running ? 'animate-pulse' : ''}`} />
                <span className={`text-[13px] font-medium ${statusColor}`}>{statusLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refetch()}
                  className="h-7 w-7 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded transition-colors"
                  title="Refresh"
                >
                  <RotateCw size={12} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => testRun.mutate()}
                  disabled={testRun.isPending || s.running}
                  title="Simulate a scheduled run (calls publish_next directly)"
                  className="h-7 px-3 text-[11px] font-medium border border-[#E5E5E5] bg-white text-[#525252] rounded hover:border-[#0A0A0A] hover:text-[#0A0A0A] disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  {testRun.isPending
                    ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                    : <Play size={11} strokeWidth={1.5} />
                  }
                  Test Run
                </button>
                <button
                  onClick={() => runNext.mutate()}
                  disabled={runNext.isPending}
                  className="h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  {runNext.isPending
                    ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                    : <Play size={11} strokeWidth={1.5} />
                  }
                  Run Next
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#F5F5F5]">
              {[
                ['Queue', queue.pending_count ?? '—'],
                ['Last run', s.last_run_at ? new Date(s.last_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'],
                ['Next run', s.next_run_at ? new Date(s.next_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'],
              ].map(([label, value]) => (
                <div key={label} className="px-5 py-3">
                  <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">{label}</p>
                  <p className="text-[14px] font-semibold text-[#0A0A0A] mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Job history */}
      <h3 className="text-[13px] font-medium text-[#0A0A0A] mb-2">Recent runs</h3>
      {historyLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 bg-[#F5F5F5] rounded animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <p className="text-[12px] text-[#A3A3A3] py-6 text-center">No runs recorded yet.</p>
      ) : (
        <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                {['Topic', 'Channel', 'Started', 'Duration', 'Status'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F5F5]">
              {history.map((row: any, i: number) => {
                const ok = row.status === 'done' || row.status === 'completed'
                const err = row.status === 'error' || row.status === 'failed'
                const dur = row.duration_seconds ? `${Math.round(row.duration_seconds)}s` : '—'
                return (
                  <tr key={i} className="hover:bg-[#FAFAFA]">
                    <td className="px-4 py-2.5 text-[#0A0A0A] max-w-[200px] truncate">{row.topic ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#525252]">{row.channel_slug ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#A3A3A3] whitespace-nowrap">{row.started_at ? new Date(row.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="px-4 py-2.5 text-[#A3A3A3]">{dur}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-medium ${ok ? 'text-[#16A34A]' : err ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>
                        {row.status ?? '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Automation Tab ───────────────────────────────────────────────────────────

function AutomationToggle({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F5F5F5] last:border-b-0">
      <div className="pr-4">
        <p className="text-[13px] font-medium text-[#0A0A0A]">{label}</p>
        <p className="text-[11px] text-[#A3A3A3] mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${value ? 'bg-[#0A0A0A]' : 'bg-[#D4D4D4]'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

function AutomationTab() {
  const toast = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['automation-settings'],
    queryFn: () => automationApi.get(),
    staleTime: 60_000,
  })

  const [values, setValues] = useState<Record<string, boolean | string>>({})
  const [dirty, setDirty] = useState(false)

  // Which storage backends can actually work here, from the server. A backend whose SDK is missing is
  // offered greyed out rather than silently accepted, because it fails on the first upload, not on save.
  // The server refuses it either way (`storage.set_backend`); this is only so the form cannot look like
  // it offered something it did not.
  const availableBackends: string[] = Array.isArray(data?.STORAGE_BACKEND_AVAILABLE)
    ? (data.STORAGE_BACKEND_AVAILABLE as string[])
    : ['local', 'r2']

  // Every model the server's registry can back (Claude, OpenAI, Gemini), keyed by model id with its rate and
  // whether the deployment holds that provider's key. Read from the server rather than hardcoded here: a
  // hand-typed list would advertise a model the registry would refuse to price.
  const modelChoices = Array.isArray(data?.AI_MODEL_CHOICES)
    ? (data.AI_MODEL_CHOICES as Array<{
        label: string
        model: string
        provider: string
        tier: string
        platform_key?: boolean
        input_usd_per_mtok: number | null
        output_usd_per_mtok: number | null
      }>)
    : []

  // Merge server values into local state when data loads
  React.useEffect(() => {
    if (data) {
      setValues({
        autoChapters:              data.AUTO_CHAPTERS === 'true' || data.autoChapters === true,
        pinComment:                data.PIN_FIRST_COMMENT === 'true' || data.pinComment === true,
        autoEndScreens:            data.AUTO_END_SCREENS === 'true' || data.autoEndScreens === true,
        redditEnabled:             data.REDDIT_ENABLED === 'true' || data.redditEnabled === true,
        autoDeleteLocalAfterUpload: data.AUTO_DELETE_LOCAL_AFTER_UPLOAD === 'true' || data.autoDeleteLocalAfterUpload === true,
        redditSubreddits:          data.REDDIT_SUBREDDITS ?? data.redditSubreddits ?? '',
        ytVis:                     data.DEFAULT_VISIBILITY ?? data.ytVis ?? 'public',
        shortsMode:                data.SHORTS_MODE ?? data.shortsMode ?? 'separate',
        openaiImageQuality:        data.OPENAI_IMAGE_QUALITY ?? data.openaiImageQuality ?? 'low',
        imageGenProvider:          data.IMAGE_GENERATION_PROVIDER ?? data.imageGenProvider ?? 'openai',
        replicateApiToken:         data.REPLICATE_API_TOKEN ?? data.replicateApiToken ?? '',
        replicateImageModel:       data.REPLICATE_IMAGE_MODEL ?? data.replicateImageModel ?? 'flux',
        openaiApiKey:              data.OPENAI_API_KEY ?? data.openaiApiKey ?? '',
        // The effective backend: the server resolves the database setting over `.env` (storage.py), so
        // this is what uploads will actually use.
        storageBackend:            data.STORAGE_BACKEND ?? data.storageBackend ?? 'local',
        // The effective default model, resolved server-side the same way (core/models.py): a setting
        // overrides `CLAUDE_MODEL`, so the raw env value would misreport what generations actually use.
        aiModel:                   data.AI_MODEL ?? data.aiModel ?? '',
      })
    }
  }, [data])

  const save = useMutation({
    mutationFn: () => automationApi.save(values),
    onSuccess: () => { toast.success('Settings saved'); setDirty(false) },
    onError: () => toast.error('Failed to save settings'),
  })

  const set = (key: string, val: boolean | string) => {
    setValues((v) => ({ ...v, [key]: val }))
    setDirty(true)
  }

  const TOGGLES = [
    { key: 'autoChapters',    label: 'Auto-add chapters',    description: 'Automatically add timestamp chapters to every uploaded video' },
    { key: 'pinComment',      label: 'Pin first comment',    description: 'Auto-publish and pin a comment on upload (e.g. "Watch part 2 →")' },
    { key: 'autoEndScreens',  label: 'Auto end screens',     description: 'Add end screen template to every video after upload' },
    { key: 'redditEnabled',   label: 'Post to Reddit',       description: 'Share YouTube link to configured subreddits after upload' },
    { key: 'autoDeleteLocalAfterUpload', label: 'Delete local files after upload', description: 'Remove rendered video + audio from disk after a successful YouTube upload' },
  ]

  if (isLoading) return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 bg-[#F5F5F5] rounded animate-pulse" />
      ))}
    </div>
  )

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Automation</h2>
      <p className="text-[12px] text-[#525252] mb-5">
        Feature toggles applied to every pipeline run. Changes write to the server <code className="text-[11px] bg-[#F5F5F5] px-1 rounded">.env</code>.
      </p>

      {/* YouTube feature toggles */}
      <div className="border border-[#E5E5E5] rounded-md bg-white overflow-hidden mb-5">
        <div className="px-5 py-2.5 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">YouTube Features</p>
        </div>
        {TOGGLES.map(({ key, label, description }) => (
          <AutomationToggle
            key={key}
            label={label}
            description={description}
            value={!!values[key]}
            onChange={(v) => set(key, v)}
          />
        ))}
      </div>

      {/* Default visibility */}
      <div className="border border-[#E5E5E5] rounded-md bg-white overflow-hidden mb-5">
        <div className="px-5 py-2.5 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">Defaults</p>
        </div>
        <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Upload Visibility</label>
          <select
            value={(values.ytVis as string) ?? 'public'}
            onChange={(e) => set('ytVis', e.target.value)}
            className="h-8 pl-3 pr-8 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </div>
        <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Companion Shorts Mode</label>
          <select
            value={(values.shortsMode as string) ?? 'separate'}
            onChange={(e) => set('shortsMode', e.target.value)}
            className="h-8 pl-3 pr-8 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
          >
            <option value="separate">Separate dedicated script (recommended)</option>
            <option value="extract">Extract from main video (legacy)</option>
          </select>
          <p className="text-[11px] text-[#A3A3A3] mt-1.5">
            <strong>Separate</strong> - AI writes a purpose-built 60-second Short script on the same topic. Better hook, native vertical content.&nbsp;
            <strong>Extract</strong> - clips are sliced from the main video's segments. No extra AI cost, but content was written for long-form.
          </p>
        </div>
        {!!values.redditEnabled && (
          <div className="px-5 py-3.5">
            <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Reddit Subreddits</label>
            <input
              type="text"
              value={(values.redditSubreddits as string) ?? ''}
              onChange={(e) => set('redditSubreddits', e.target.value)}
              placeholder="videos,youtubers,learnprogramming"
              className="w-full h-8 px-3 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4] max-w-sm"
            />
            <p className="text-[11px] text-[#A3A3A3] mt-1">Comma-separated, without r/ prefix.</p>
          </div>
        )}
      </div>

      {/* Where finished videos are stored. Saved to the database, not .env, so it survives a restart. */}
      <div className="border border-[#E5E5E5] rounded-md bg-white overflow-hidden mb-5">
        <div className="px-5 py-2.5 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">Storage</p>
        </div>
        <div className="px-5 py-3.5">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Storage Backend</label>
          <select
            value={(values.storageBackend as string) ?? 'local'}
            onChange={(e) => set('storageBackend', e.target.value)}
            className="h-8 pl-3 pr-8 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
          >
            <option value="local">Local disk (development only)</option>
            <option value="r2">Cloudflare R2</option>
            {/* Offered but disabled when the SDK is absent: the backend imports it on the first
                upload, so choosing it would look like it worked and then fail mid-render. */}
            <option value="azure" disabled={!availableBackends.includes('azure')}>
              Azure Blob Storage{availableBackends.includes('azure') ? '' : ' — not installed on this deployment'}
            </option>
          </select>
          <p className="text-[11px] text-[#A3A3A3] mt-1.5">
            Where new renders and Shorts are uploaded. <strong>Local disk is not usable on a hosted
            deployment</strong> — the container filesystem is ephemeral, so the files disappear on the
            next restart. This setting is stored in the database and applies immediately.
          </p>
          <p className="text-[11px] text-[#A3A3A3] mt-1">
            Changing it does not move files that are already uploaded: links recorded earlier were
            built for the previous backend. Only switch while nothing published depends on them.
          </p>
        </div>
        <div className="px-5 py-3.5 border-t border-[#F0F0F0]">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">System default script model</label>
          <select
            value={(values.aiModel as string) ?? ''}
            onChange={(e) => set('aiModel', e.target.value)}
            className="h-8 pl-3 pr-8 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
          >
            {/* Empty is a real state, not a placeholder: it means "unset", so the server falls back to
                `CLAUDE_MODEL` and then to the registry. Offering it avoids a form that silently rewrites a
                setting nobody chose to change. */}
            <option value="">Use the environment / registry default</option>
            {modelChoices.map((c) => (
              <option key={c.model} value={c.model}>
                {c.label} ({c.tier})
                {c.input_usd_per_mtok != null ? ` — $${c.input_usd_per_mtok}/$${c.output_usd_per_mtok} per M` : ''}
                {c.platform_key === false ? ' — no platform key' : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-[#A3A3A3] mt-1.5">
            What every new script and topic list is generated with. Moving it moves <strong>quality and
            cost together</strong>, which is why it is a setting rather than a constant. Stored in the
            database and applied to the next generation — the quote and the meter read the same rate.
          </p>
          <p className="text-[11px] text-[#A3A3A3] mt-1">
            This is the model every plan's price includes and what Free accounts always use. Paid accounts can
            pick their own in Preferences; a model marked "no platform key" needs its provider key in the
            environment, otherwise renders fall back.
          </p>
        </div>
      </div>

      {/* AI image generation provider */ }
      <div className="border border-[#E5E5E5] rounded-md bg-white overflow-hidden mb-5">
        <div className="px-5 py-2.5 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">AI Image Generation</p>
        </div>
        <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Default Provider</label>
          <select
            value={(values.imageGenProvider as string) ?? 'openai'}
            onChange={(e) => set('imageGenProvider', e.target.value)}
            className="h-8 pl-3 pr-8 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
          >
            <option value="openai">OpenAI gpt-image-1 (paid)</option>
            <option value="replicate">Replicate Flux/SDXL (paid, cheaper)</option>
            <option value="pollinations">Pollinations.ai (free)</option>
          </select>
          <p className="text-[11px] text-[#A3A3A3] mt-1">Platform-wide default. Per-channel override lives in channel settings.</p>
        </div>
        <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">OpenAI Quality</label>
          <select
            value={(values.openaiImageQuality as string) ?? 'low'}
            onChange={(e) => set('openaiImageQuality', e.target.value)}
            className="h-8 pl-3 pr-8 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
          >
            <option value="low">Low (~$0.01/image — recommended)</option>
            <option value="medium">Medium (~$0.04/image)</option>
            <option value="high">High (~$0.17/image)</option>
          </select>
        </div>
        <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">OpenAI API Key</label>
          <input
            type="text"
            value={(values.openaiApiKey as string) ?? ''}
            onChange={(e) => set('openaiApiKey', e.target.value)}
            placeholder="sk-********************"
            className="w-full h-8 px-3 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
          />
          <p className="text-[11px] text-[#A3A3A3] mt-1">Get it at platform.openai.com/api-keys. Used when provider = openai (and for channel art).</p>
        </div>
        <div className="px-5 py-3.5 border-b border-[#F5F5F5]">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Replicate Model</label>
          <select
            value={(values.replicateImageModel as string) ?? 'flux'}
            onChange={(e) => set('replicateImageModel', e.target.value)}
            className="h-8 pl-3 pr-8 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
          >
            <option value="flux">Flux Schnell (fast, ~$0.003-0.01/image)</option>
            <option value="sdxl">Stable Diffusion XL (~$0.002-0.008/image)</option>
          </select>
          <p className="text-[11px] text-[#A3A3A3] mt-1">Only used when provider = replicate.</p>
        </div>
        <div className="px-5 py-3.5">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Replicate API Token</label>
          <input
            type="text"
            value={(values.replicateApiToken as string) ?? ''}
            onChange={(e) => set('replicateApiToken', e.target.value)}
            placeholder="r8_********************"
            className="w-full h-8 px-3 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
          />
          <p className="text-[11px] text-[#A3A3A3] mt-1">Get it at replicate.com/account/api-tokens. Only used when provider = replicate.</p>
        </div>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={!dirty || save.isPending}
        className="h-8 px-4 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
      >
        {save.isPending && <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />}
        Save changes
      </button>
    </div>
  )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  const toast = useToast()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: notificationsApi.getPrefs,
  })

  const prefs = data?.prefs
  const smtpOk = data?.smtp_configured ?? false

  const [local, setLocal] = useState<NotificationPrefs>({
    notify_on_complete: true,
    notify_on_error: true,
    email_override: null,
  })
  const [emailInput, setEmailInput] = useState('')
  const [testing, setTesting] = useState(false)

  // Sync prefs → local once loaded
  useEffect(() => {
    if (prefs) {
      setLocal(prefs)
      setEmailInput(prefs.email_override || '')
    }
  }, [prefs])

  const saveMutation = useMutation({
    mutationFn: (p: NotificationPrefs) => notificationsApi.updatePrefs(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-prefs'] })
      toast.success('Notification preferences saved')
    },
    onError: () => toast.error('Failed to save preferences'),
  })

  const handleToggle = (key: 'notify_on_complete' | 'notify_on_error') => {
    const updated = { ...local, [key]: !local[key] }
    setLocal(updated)
    saveMutation.mutate({ ...updated, email_override: emailInput.trim() || null })
  }

  const handleEmailBlur = () => {
    const updated = { ...local, email_override: emailInput.trim() || null }
    setLocal(updated)
    saveMutation.mutate(updated)
  }

  const handleTestEmail = async () => {
    setTesting(true)
    try {
      const res = await notificationsApi.sendTest()
      toast.success(`Test email sent to ${res.sent_to}`)
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Failed to send test email'))
    } finally {
      setTesting(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-[#A3A3A3] text-sm py-8"><Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> Loading…</div>
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Notifications</h2>
        <p className="text-[12px] text-[#525252]">Email alerts when pipeline jobs finish or fail.</p>
      </div>

      {/* SMTP warning */}
      {!smtpOk && (
        <div className="flex gap-3 bg-[#FFFBEB] border border-[#FEF08A] rounded-md p-4">
          <Mail size={15} strokeWidth={1.5} className="text-[#A16207] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-[#A16207] mb-0.5">SMTP not configured</p>
            <p className="text-[12px] text-[#525252]">
              Set <code className="bg-[#F5F5F5] px-1 rounded text-[11px]">SMTP_HOST</code>,{' '}
              <code className="bg-[#F5F5F5] px-1 rounded text-[11px]">SMTP_USER</code>, and{' '}
              <code className="bg-[#F5F5F5] px-1 rounded text-[11px]">SMTP_PASS</code> in your
              server environment to enable email delivery.
            </p>
          </div>
        </div>
      )}

      {/* Toggle rows */}
      <div className="bg-white border border-[#E5E5E5] rounded-md divide-y divide-[#F5F5F5]">
        {[
          { key: 'notify_on_complete' as const, label: 'Job completed', desc: 'Email when a video is published to YouTube' },
          { key: 'notify_on_error'    as const, label: 'Job failed',    desc: 'Email when a pipeline run encounters an error' },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-[13px] font-medium text-[#0A0A0A]">{label}</p>
              <p className="text-[11px] text-[#A3A3A3] mt-0.5">{desc}</p>
            </div>
            <button
              role="switch"
              aria-checked={local[key]}
              onClick={() => handleToggle(key)}
              className={[
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0',
                local[key] ? 'bg-[#0A0A0A]' : 'bg-[#E5E5E5]',
              ].join(' ')}
            >
              <span className={[
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                local[key] ? 'translate-x-4' : 'translate-x-1',
              ].join(' ')} />
            </button>
          </div>
        ))}
      </div>

      {/* Email override */}
      <div className="bg-white border border-[#E5E5E5] rounded-md p-5">
        <label className="block text-[12px] font-semibold text-[#0A0A0A] mb-1.5">
          Notification email
        </label>
        <p className="text-[11px] text-[#A3A3A3] mb-3">
          Leave blank to use your account email. Set an override to send to a different address.
        </p>
        <input
          type="email"
          value={emailInput}
          onChange={e => setEmailInput(e.target.value)}
          onBlur={handleEmailBlur}
          placeholder="override@example.com (optional)"
          className="w-full border border-[#E5E5E5] rounded px-3 py-2 text-[13px] text-[#0A0A0A] placeholder:text-[#D4D4D4] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]"
        />
      </div>

      {/* Test email */}
      <div className="flex items-center gap-3">
        <button
          disabled={!smtpOk || testing}
          onClick={handleTestEmail}
          className="flex items-center gap-2 px-4 py-2 border border-[#E5E5E5] rounded-md text-[13px] font-medium text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testing
            ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
            : <SendHorizonal size={13} strokeWidth={1.5} />}
          Send test email
        </button>
        {!smtpOk && (
          <span className="text-[11px] text-[#A3A3A3]">Configure SMTP to enable</span>
        )}
      </div>
    </div>
  )
}

// ─── Account Tab ──────────────────────────────────────────────────────────────

function _initials(name: string, email: string): string {
  const src = name.trim() || email
  const parts = src.split(/[\s@.]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

// Must cover every plan id core/metering.PLAN_CREDITS knows about, otherwise a
// Starter/Studio/Agency customer sees their raw plan id instead of a label.
const PLAN_LABELS: Record<string, string> = {
  free: 'Free', starter: 'Starter', pro: 'Pro', studio: 'Studio',
  agency: 'Agency', enterprise: 'Enterprise', unlimited: 'Unlimited',
}
// Credit allowance per plan (0 = unmetered). Videos are no longer the currency.
const PLAN_CREDITS: Record<string, number> = {
  free: 40, starter: 300, pro: 900, studio: 2200, agency: 8000,
  enterprise: 0, unlimited: 0,
}

function AccountTab() {
  const toast = useToast()
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // logout() only clears store/token state - it never redirects. Without this,
  // "Sign out of this device" and account deletion left the user stranded on a
  // fully-rendered but unauthenticated Settings page instead of returning to /login.
  const handleSignOut = async () => {
    await logout()
    navigate('/login')
  }

  // ── Profile load ──────────────────────────────────────────────────────────
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: accountApi.getProfile,
  })
  const profile = profileData?.profile

  // Credits are the currency now; the profile's video counter is dead.
  const { data: creditsUsage } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    staleTime: 30_000,
  })

  const [displayName, setDisplayName] = useState('')
  useEffect(() => { if (profile) setDisplayName(profile.display_name || '') }, [profile])

  const saveName = useMutation({
    mutationFn: () => accountApi.updateProfile(displayName),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user-profile'] }); toast.success('Display name saved') },
    onError: () => toast.error('Failed to save'),
  })

  // ── Password change (Supabase Auth) ───────────────────────────────────────
  const [newPass, setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showNew, setShowNew]         = useState(false)
  const [changingPass, setChangingPass] = useState(false)

  const handleChangePassword = async () => {
    if (!newPass || newPass.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (newPass !== confirmPass)         { toast.error('Passwords do not match'); return }
    setChangingPass(true)
    try {
      const { data } = await apiClient.post('/api/auth/change-password', { new_password: newPass })
      if (!data.ok) throw new Error('Password update failed')
      toast.success('Password changed successfully')
      setNewPass(''); setConfirmPass('')
    } catch (e: any) {
      toast.error(e.message || 'Failed to change password')
    } finally {
      setChangingPass(false)
    }
  }

  // ── Delete account ────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showDeleteZone, setShowDeleteZone] = useState(false)

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') { toast.error('Type DELETE to confirm'); return }
    setDeleting(true)
    try {
      await accountApi.deleteAccount()
      await logout()
      navigate('/login')
    } catch (e: any) {
      toast.error(apiErrorMessage(e, 'Failed to delete account'))
      setDeleting(false)
    }
  }

  if (profileLoading) {
    return <div className="flex items-center gap-2 text-[#A3A3A3] text-sm py-8"><Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> Loading…</div>
  }

  const email = profile?.email || ''
  const plan  = profile?.plan  || 'free'
  // Credits, not videos: `videos_used_this_month` is no longer incremented by
  // anything, so this bar used to sit at 0 forever.
  const allowance = PLAN_CREDITS[plan] ?? 40
  const remaining = creditsUsage?.credits_remaining ?? null
  const unlimitecredits = allowance === 0
  const used = remaining != null ? Math.max(0, allowance - remaining) : 0
  const usagePct = (!unlimitecredits && allowance > 0) ? Math.min(100, Math.round(used / allowance * 100)) : 0

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Account</h2>
        <p className="text-[12px] text-[#525252]">Profile, password, and account management.</p>
      </div>

      {/* Profile card */}
      <div className="bg-white border border-[#E5E5E5] rounded-md p-5 space-y-4">
        {/* Avatar row */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#0A0A0A] flex items-center justify-center flex-shrink-0">
            <span className="text-[15px] font-bold text-white tracking-wide">
              {_initials(displayName || profile?.display_name || '', email)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#0A0A0A] truncate">{email}</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${
              plan === 'enterprise' || plan === 'unlimited' ? 'bg-[#0A0A0A] text-white' :
              plan === 'pro'        ? 'bg-[#F5F5F5] text-[#0A0A0A] border border-[#E5E5E5]' :
                                      'bg-[#F5F5F5] text-[#A3A3A3]'
            }`}>{PLAN_LABELS[plan] || plan}</span>
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className="block text-[11px] font-semibold text-[#A3A3A3] uppercase tracking-wider mb-1.5">Display name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={80}
              className="flex-1 border border-[#E5E5E5] rounded px-3 py-2 text-[13px] text-[#0A0A0A] placeholder:text-[#D4D4D4] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]"
            />
            <button
              disabled={saveName.isPending}
              onClick={() => saveName.mutate()}
              className="px-4 py-2 bg-[#0A0A0A] text-white text-[13px] font-medium rounded hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              {saveName.isPending ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>

        {/* Credit bar (hidden for unmetered plans) */}
        {!unlimitecredits && (
          <div>
            <div className="flex justify-between text-[11px] text-[#A3A3A3] mb-1.5">
              <span>Credits used this period</span>
              <span className="tabular-nums text-[#0A0A0A] font-medium">
                {used} / {allowance}
                {remaining != null && <span className="text-[#A3A3A3] font-normal"> · {remaining} left</span>}
              </span>
            </div>
            <div className="h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-[#BE123C]' : 'bg-[#0A0A0A]'}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Change password */}
      <div className="bg-white border border-[#E5E5E5] rounded-md p-5 space-y-3">
        <h3 className="text-[12px] font-semibold text-[#0A0A0A] uppercase tracking-wider">Change password</h3>
        {(['New password', 'Confirm password'] as const).map((label, i) => {
          const val   = i === 0 ? newPass    : confirmPass
          const setFn = i === 0 ? setNewPass : setConfirmPass
          return (
            <div key={label} className="relative">
              <label className="block text-[11px] text-[#A3A3A3] mb-1">{label}</label>
              <input
                type={showNew ? 'text' : 'password'}
                value={val}
                onChange={e => setFn(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-[#E5E5E5] rounded px-3 py-2 pr-9 text-[13px] text-[#0A0A0A] placeholder:text-[#D4D4D4] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]"
              />
              {i === 0 && (
                <button
                  type="button"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                  onClick={() => setShowNew(p => !p)}
                  className="absolute right-3 bottom-2.5 text-[#A3A3A3] hover:text-[#525252]"
                >
                  {showNew ? <EyeOff size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
                </button>
              )}
            </div>
          )
        })}
        <button
          disabled={!newPass || !confirmPass || changingPass}
          onClick={handleChangePassword}
          className="flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] text-white text-[13px] font-medium rounded hover:bg-[#262626] transition-colors disabled:opacity-40"
        >
          {changingPass ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" /> : null}
          Change password
        </button>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 text-[13px] text-[#525252] hover:text-[#0A0A0A] transition-colors"
      >
        <LogOut size={13} strokeWidth={1.5} />
        Sign out of this device
      </button>

      {/* Danger zone */}
      <div className="border border-[#FECDD3] rounded-md overflow-hidden">
        <button
          onClick={() => setShowDeleteZone(p => !p)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={14} strokeWidth={1.5} className="text-[#BE123C]" />
            <span className="text-[13px] font-semibold text-[#BE123C]">Danger zone</span>
          </div>
          <ChevronRight size={14} strokeWidth={1.5} className={`text-[#BE123C] transition-transform ${showDeleteZone ? 'rotate-90' : ''}`} />
        </button>
        {showDeleteZone && (
          <div className="px-5 pb-5 bg-[#FFF1F2] space-y-3 border-t border-[#FECDD3]">
            <p className="text-[12px] text-[#BE123C] pt-4">
              This permanently removes your Vidora account data. Your Supabase auth record will remain - contact support if you need it fully deleted.
            </p>
            <label className="block text-[11px] text-[#BE123C] font-semibold mb-1">
              Type <code className="bg-white px-1 rounded border border-[#FECDD3]">DELETE</code> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full border border-[#FECDD3] rounded px-3 py-2 text-[13px] text-[#BE123C] bg-white placeholder:text-[#FECDD3] focus:outline-none focus:ring-1 focus:ring-[#BE123C]"
            />
            <button
              disabled={deleteConfirm !== 'DELETE' || deleting}
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-[#BE123C] text-white text-[13px] font-medium rounded hover:bg-[#9F1239] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={12} strokeWidth={1.5} />}
              Delete my account
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Voices Tab ──────────────────────────────────────────────────────────────

function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-[#525252] w-20 flex-shrink-0">{label}</span>
      <input
        type="range" min={0} max={1} step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-[#0A0A0A] cursor-pointer"
        aria-label={label}
      />
      <span className="text-[12px] font-mono text-[#0A0A0A] w-9 text-right">{value.toFixed(2)}</span>
    </div>
  )
}

function VoicesTab() {
  const toast = useToast()
  const { data: channels = [] } = useChannels()

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: voiceData, isLoading } = useQuery({
    queryKey: ['voices-list'],
    queryFn: () => voiceApi.list(),
    staleTime: 5 * 60 * 1000,
  })
  const { data: assignments = {}, refetch: refetchAssignments } = useQuery({
    queryKey: ['voices-assignments'],
    queryFn: () => voiceApi.assignments(),
    staleTime: 30 * 1000,
  })

  // ── UI state ─────────────────────────────────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState<string>('recommended')
  const [selectedChannel, setSelectedChannel] = useState<string>('')
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [voiceSearch, setVoiceSearch] = useState('')
  const [assigning, setAssigning] = useState<string | null>(null)
  // Voice auditioning. One <audio> for the whole tab: two samples playing over each other is never what
  // someone wants while comparing voices, and stopping one when another starts is the whole behaviour.
  const [previewing, setPreviewing] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  // ── ElevenLabs state ─────────────────────────────────────────────────────
  const [elVoiceId, setElVoiceId]       = useState('')
  const [elStability, setElStability]   = useState(0.48)
  const [elSimilarity, setElSimilarity] = useState(0.82)
  const [elStyle, setElStyle]           = useState(0.35)
  const [savingEl, setSavingEl]         = useState(false)
  const [provider, setProvider]         = useState<'edge' | 'elevenlabs'>('edge')

  useEffect(() => {
    if (!voiceData?.ok) return
    setElVoiceId(voiceData.elevenlabs_voice_id || '')
    setElStability(voiceData.elevenlabs_stability ?? 0.48)
    setElSimilarity(voiceData.elevenlabs_similarity ?? 0.82)
    setElStyle(voiceData.elevenlabs_style ?? 0.35)
    setProvider((voiceData.tts_provider as 'edge' | 'elevenlabs') ?? 'edge')
  }, [voiceData])

  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0].slug)
    }
  }, [channels, selectedChannel])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const saveElSettings = async () => {
    setSavingEl(true)
    try {
      await voiceApi.saveElevenLabsSettings({
        voice_id: elVoiceId,
        stability: elStability,
        similarity: elSimilarity,
        style: elStyle,
        tts_provider: provider,
      })
      toast.success('Voice settings saved')
    } catch { toast.error('Failed to save settings') }
    finally { setSavingEl(false) }
  }

  // Choosing a provider IS the save. Before this, the only Save button lived inside the ElevenLabs panel,
  // so selecting Edge TTS hid the one control that could persist the choice — and the endpoint it called
  // only rewrote .env, which the running process had already read.
  const [savingProvider, setSavingProvider] = useState<string | null>(null)
  const chooseProvider = async (next: 'edge' | 'elevenlabs') => {
    setProvider(next)
    setSavingProvider(next)
    try {
      await voiceApi.saveElevenLabsSettings({
        voice_id: elVoiceId || undefined,
        stability: elStability,
        similarity: elSimilarity,
        style: elStyle,
        tts_provider: next,
      })
      toast.success(`Default voice provider: ${next === 'edge' ? 'Edge TTS' : 'ElevenLabs'}`)
    } catch {
      toast.error('Could not save the provider — it will revert on reload')
    } finally {
      setSavingProvider(null)
    }
  }

  const assignVoice = async (voiceId: string) => {
    if (!selectedChannel) { toast.error('Select a channel first'); return }
    setAssigning(voiceId)
    try {
      await voiceApi.setChannelVoice(selectedChannel, voiceId)
      await refetchAssignments()
      const name = activeGroup?.voices.find(v => v.id === voiceId)?.name ?? voiceId
      toast.success(`Voice set for ${selectedChannel}: ${name}`)
    } catch { toast.error('Failed to assign voice') }
    finally { setAssigning(null) }
  }

  // Audition a voice. The sample is fetched as a blob because the endpoint requires the bearer token,
  // which an <audio src> cannot send — which is why a plain "test" link could never have worked.
  const previewVoice = async (voiceId: string) => {
    if (previewing === voiceId) {
      audioRef.current?.pause()
      setPreviewing(null)
      return
    }
    setPreviewing(voiceId)
    try {
      const url = await voiceApi.preview(voiceId)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = url
      const el = audioRef.current ?? new Audio()
      audioRef.current = el
      el.onended = () => setPreviewing(null)
      el.onerror = () => { setPreviewing(null); toast.error('Could not play that sample') }
      el.src = url
      await el.play()
    } catch {
      setPreviewing(null)
      toast.error('Preview unavailable — the Edge voice service did not respond')
    }
  }

  // Stop the sample and release the blob when the tab unmounts.
  useEffect(() => () => {
    audioRef.current?.pause()
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  const groups: VoiceGroup[] = voiceData?.groups ?? []
  const activeGroup = groups.find(g => g.id === selectedGroup)

  // Counts are DERIVED from the API payload, never hard-coded: the Edge blurb
  // used to advertise "40+ languages · 150+ voices" while the registry had grown
  // to 77 languages and 312 voices, so the claim silently went stale.
  const edgeVoiceCount = new Set(groups.flatMap(g => g.voices.map(v => v.id))).size
  const edgeLanguageCount = new Set(
    groups
      .filter(g => g.id !== 'recommended')  // multilingual duplicates of the groups below
      .flatMap(g => g.voices.map(v => v.lang ?? 'English'))
  ).size

  const voiceQuery = voiceSearch.trim().toLowerCase()
  const filteredVoices: VoiceEntry[] = (activeGroup?.voices ?? []).filter(v => {
    if (genderFilter !== 'all' && v.gender !== genderFilter) return false
    if (!voiceQuery) return true
    return `${v.name} ${v.locale ?? ''} ${v.lang ?? ''} ${v.region ?? ''}`
      .toLowerCase()
      .includes(voiceQuery)
  })

  // ── Assigned voice for current channel ───────────────────────────────────
  const currentAssignment = selectedChannel ? assignments[selectedChannel] : null

  if (isLoading) return (
    <div className="space-y-3 mt-2">
      {[1, 2, 3].map(i => <div key={i} className="h-10 bg-[#F5F5F5] rounded animate-pulse" />)}
    </div>
  )

  return (
    <div className="space-y-6">

      {/* ── Provider toggle ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Voice Provider</h2>
        <p className="text-[12px] text-[#525252] mb-3">Choose the TTS engine used when generating narration.</p>
        <div className="flex gap-2">
          {(['edge', 'elevenlabs'] as const).map(p => (
            <button
              key={p}
              onClick={() => chooseProvider(p)}
              disabled={savingProvider !== null}
              className={[
                'flex-1 border rounded-lg p-3.5 text-left transition-colors relative',
                provider === p
                  ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                  : 'border-[#E5E5E5] bg-white text-[#525252] hover:border-[#A3A3A3]',
                savingProvider !== null && savingProvider !== p ? 'opacity-50' : '',
              ].join(' ')}
            >
              <p className={`text-[13px] font-semibold ${provider === p ? 'text-white' : 'text-[#0A0A0A]'}`}>
                {p === 'edge' ? 'Edge TTS' : 'ElevenLabs'}
              </p>
              <p className={`text-[11px] mt-0.5 ${provider === p ? 'text-white/70' : 'text-[#A3A3A3]'}`}>
                {p === 'edge'
                  ? `Free · ${edgeLanguageCount} languages · ${edgeVoiceCount} voices`
                  : 'Premium AI · Ultra-realistic · Requires API key'}
              </p>
              {savingProvider === p && (
                <Loader2 size={12} strokeWidth={1.5}
                         className={`animate-spin absolute top-3 right-3 ${provider === p ? 'text-white/80' : 'text-[#A3A3A3]'}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── ElevenLabs panel ────────────────────────────────────────────── */}
      {provider === 'elevenlabs' && (
        <div className="border border-[#E5E5E5] rounded-lg bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center gap-2">
            <Mic size={13} strokeWidth={1.5} className="text-[#525252]" />
            <p className="text-[12px] font-medium text-[#0A0A0A]">ElevenLabs Configuration</p>
            {!voiceData?.elevenlabs_configured && (
              <span className="ml-auto text-[10px] font-medium text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded px-2 py-0.5">API key not set</span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {!voiceData?.elevenlabs_configured && (
              <p className="text-[12px] text-[#525252] bg-[#FFFBEB] border border-[#FEF3C7] rounded p-3">
                Add your ElevenLabs key in the <strong>API Keys</strong> tab to enable premium voices.
              </p>
            )}
            <div>
              <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Voice ID</label>
              <div className="flex gap-2">
                <input
                  value={elVoiceId}
                  onChange={e => setElVoiceId(e.target.value)}
                  placeholder="e.g. JBFqnCBsd6RMkjVDRZzb"
                  className="flex-1 h-8 px-3 text-[12px] font-mono bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
                />
                <a
                  href="https://elevenlabs.io/app/voice-library"
                  target="_blank" rel="noopener noreferrer"
                  aria-label="Browse ElevenLabs voice library"
                  className="h-8 w-8 flex items-center justify-center border border-[#E5E5E5] rounded text-[#A3A3A3] hover:text-[#525252] transition-colors"
                >
                  <ExternalLink size={12} strokeWidth={1.5} />
                </a>
              </div>
            </div>
            <div className="space-y-3">
              <SliderField label="Stability" value={elStability} onChange={setElStability} />
              <SliderField label="Clarity"   value={elSimilarity} onChange={setElSimilarity} />
              <SliderField label="Style"     value={elStyle}      onChange={setElStyle} />
            </div>
            <button
              onClick={saveElSettings}
              disabled={savingEl}
              className="h-8 px-4 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              {savingEl && <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />}
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* ── Edge TTS Voice Browser ───────────────────────────────────────── */}
      <div>
        {/* The two sections are coupled and nothing said so: assigning an Edge voice does nothing while
            ElevenLabs is the provider. That is the kind of gap that reads as "my change was ignored". */}
        {provider !== 'edge' && (
          <div className="flex items-center gap-3 px-4 py-2.5 mb-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
            <p className="text-[12px] text-[#B45309] flex-1">
              These voices only apply when <strong>Edge TTS</strong> is the provider — you are on ElevenLabs.
            </p>
            <button
              onClick={() => chooseProvider('edge')}
              disabled={savingProvider !== null}
              className="h-7 px-3 text-[11px] font-medium bg-white border border-[#FDE68A] text-[#B45309] rounded hover:bg-[#FEF3C7] transition-colors disabled:opacity-40"
            >
              Use Edge TTS
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0A0A0A]">Edge TTS Voice Browser</h2>
            <p className="text-[12px] text-[#525252] mt-0.5">Browse and assign voices to channels.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Search -- the picker lists 300+ voices, so the tabs alone are slow */}
            <input
              type="search"
              value={voiceSearch}
              onChange={e => setVoiceSearch(e.target.value)}
              placeholder="Search voices…"
              aria-label="Search voices"
              className="h-7 w-40 px-2 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
            />
            {/* Gender filter */}
            <div className="flex border border-[#E5E5E5] rounded overflow-hidden">
              {(['all', 'male', 'female'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGenderFilter(g)}
                  aria-label={`Show ${g} voices`}
                  className={[
                    'px-2.5 h-7 text-[11px] font-medium transition-colors',
                    genderFilter === g ? 'bg-[#0A0A0A] text-white' : 'text-[#525252] hover:bg-[#F5F5F5]',
                  ].join(' ')}
                >
                  {g === 'all' ? 'All' : g === 'male' ? '♂ Male' : '♀ Female'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Channel selector */}
        <div className="flex items-center gap-3 mb-4 p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-lg">
          <label className="text-[12px] text-[#525252] font-medium flex-shrink-0">Assign to channel:</label>
          <select
            value={selectedChannel}
            onChange={e => setSelectedChannel(e.target.value)}
            className="flex-1 h-7 px-2 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
          >
            {channels.map(ch => <option key={ch.slug} value={ch.slug}>{ch.name || ch.slug}</option>)}
            {channels.length === 0 && <option value="">No channels connected</option>}
          </select>
          {currentAssignment && (
            <span className="text-[11px] text-[#525252] flex-shrink-0">
              Current: <span className="font-medium text-[#0A0A0A]">{currentAssignment.split('-').slice(2).join('-').replace('Neural', '')}</span>
            </span>
          )}
        </div>

        {/* Language group tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-4" role="tablist" aria-label="Language groups">
          {groups.map(g => (
            <button
              key={g.id}
              role="tab"
              aria-selected={selectedGroup === g.id}
              onClick={() => setSelectedGroup(g.id)}
              className={[
                'flex-shrink-0 px-3 h-7 text-[12px] font-medium rounded-full transition-colors',
                selectedGroup === g.id
                  ? 'bg-[#0A0A0A] text-white'
                  : 'bg-[#F5F5F5] text-[#525252] hover:bg-[#E5E5E5]',
              ].join(' ')}
            >
              {g.label}
              <span className="ml-1.5 text-[10px] opacity-60">{g.voices.length}</span>
            </button>
          ))}
        </div>

        {/* Voice cards grid */}
        {filteredVoices.length === 0 ? (
          <p className="text-[13px] text-[#A3A3A3] py-8 text-center">No voices match the current filter.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {filteredVoices.map(voice => {
              const isAssigned = currentAssignment === voice.id
              const isWorking  = assigning === voice.id
              return (
                <div
                  key={voice.id}
                  aria-current={isAssigned ? 'true' : undefined}
                  className={[
                    'border rounded-lg p-3 flex flex-col gap-2 transition-all',
                    // The selected voice is the one fact this grid must communicate at a glance: a ring,
                    // a tinted surface and a labelled badge, not just a slightly darker border.
                    isAssigned
                      ? 'border-[#0A0A0A] bg-[#F5F5F5] ring-2 ring-[#0A0A0A] ring-offset-1'
                      : 'border-[#E5E5E5] bg-white hover:border-[#A3A3A3]',
                  ].join(' ')}
                >
                  {/* Name row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#0A0A0A] leading-tight">{voice.name}</p>
                      {isAssigned && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[#16A34A]">
                          <Check size={9} strokeWidth={2.5} /> Selected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {voice.gender && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          voice.gender === 'female' ? 'bg-[#FDF2F8] text-[#9D174D]' : 'bg-[#EFF6FF] text-[#1E40AF]'
                        }`}>{voice.gender === 'female' ? '♀' : '♂'}</span>
                      )}
                      <button
                        onClick={() => previewVoice(voice.id)}
                        aria-label={previewing === voice.id ? `Stop ${voice.name}` : `Preview ${voice.name}`}
                        title={previewing === voice.id ? 'Stop' : 'Play a short sample'}
                        className={[
                          'h-6 w-6 flex items-center justify-center rounded border transition-colors',
                          previewing === voice.id
                            ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                            : 'border-[#E5E5E5] bg-white text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A]',
                        ].join(' ')}
                      >
                        {previewing === voice.id
                          ? <Square size={8} strokeWidth={2.5} fill="currentColor" />
                          : <Play size={9} strokeWidth={2} fill="currentColor" />}
                      </button>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-1">
                    {voice.locale && (
                      <span className="text-[10px] font-mono bg-[#F5F5F5] text-[#525252] px-1.5 py-0.5 rounded">{voice.locale}</span>
                    )}
                    {(voice.lang || voice.region) && (
                      <span className="text-[10px] text-[#A3A3A3]">{voice.lang || voice.region}</span>
                    )}
                    {voice.desc && (
                      <span className="text-[10px] text-[#A3A3A3] italic">{voice.desc}</span>
                    )}
                    {voice.multilingual && (
                      <span className="text-[9px] font-medium text-[#7C3AED] bg-[#F5F3FF] px-1.5 py-0.5 rounded">Multilingual</span>
                    )}
                  </div>

                  {/* Assign button */}
                  <button
                    onClick={() => !isAssigned && assignVoice(voice.id)}
                    disabled={isAssigned || isWorking || !selectedChannel}
                    aria-label={isAssigned ? `${voice.name} is assigned` : `Assign ${voice.name}`}
                    className={[
                      'mt-auto h-6 px-2 text-[11px] font-medium rounded flex items-center justify-center gap-1 transition-colors',
                      isAssigned
                        ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] cursor-default'
                        : 'bg-[#F5F5F5] text-[#525252] hover:bg-[#0A0A0A] hover:text-white border border-transparent disabled:opacity-40',
                    ].join(' ')}
                  >
                    {isWorking ? <Loader2 size={10} strokeWidth={1.5} className="animate-spin" />
                      : isAssigned ? <><Check size={10} strokeWidth={2} /> Assigned</>
                      : 'Assign'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Channel assignments summary ──────────────────────────────────── */}
      {Object.keys(assignments).length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-[#0A0A0A] mb-2">Channel Assignments</h3>
          <div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
            {Object.entries(assignments).map(([slug, vid]) => (
              <div key={slug} className="flex items-center gap-4 px-4 py-2.5 border-b border-[#F5F5F5] last:border-b-0">
                <span className="text-[12px] font-medium text-[#0A0A0A] min-w-[120px]">{slug}</span>
                <span className="text-[12px] text-[#525252] font-mono flex-1">{vid}</span>
                <button
                  onClick={() => setSelectedChannel(slug)}
                  aria-label={`Edit voice for ${slug}`}
                  className="text-[11px] text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors"
                >
                  <ChevronRight size={13} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  // Scheduler and Automation write the deployment's .env; a tenant must not see a control that changes
  // everyone's configuration (and that cannot even read back their own values).
  const visibleTabs = TABS.filter((t) => isAdmin || !PLATFORM_TABS.includes(t.id))

  const [activeTab, setActiveTab] = useState<Tab>('api-keys')

  // If the role changes under us (logout of an admin, impersonation) and the open tab is now hidden,
  // fall back instead of leaving the panel mounted with no tab selected.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab('api-keys')
  }, [isAdmin, activeTab])  // eslint-disable-line react-hooks/exhaustive-deps

  const content: Record<Tab, React.ReactNode> = {
    'api-keys':      <APIKeysTab />,
    voices:          <VoicesTab />,
    social:          <SocialAccountsTab />,
    scheduler:       <SchedulerTab />,
    automation:      <AutomationTab />,
    integrations:    <IntegrationsTab />,
    preferences:     <PreferencesTab />,
    notifications:   <NotificationsTab />,
    account:         <AccountTab />,
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Settings</h1>
        <p className="text-[13px] text-[#525252] mt-0.5">API keys, integrations, preferences, and account.</p>
      </div>

      {/* Underline tab bar */}
      <div role="tablist" aria-label="Settings sections" className="flex border-b border-[#E5E5E5] mb-6">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            data-settings-tab={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'mr-6 pb-3 text-[13px] transition-colors border-b-2',
              activeTab === tab.id
                ? 'border-[#0A0A0A] text-[#0A0A0A] font-semibold'
                : 'border-transparent text-[#525252] hover:text-[#0A0A0A]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isAdmin || !PLATFORM_TABS.includes(activeTab) ? content[activeTab] : null}
    </div>
  )
}
