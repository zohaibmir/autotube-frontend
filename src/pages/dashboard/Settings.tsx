import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ExternalLink, Trash2, RefreshCw, Play, Square, RotateCw, Mic, Check, ChevronRight, Bell, Mail, SendHorizonal, LogOut, AlertTriangle, User2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useByokStatus, useByokSave, useByokRemove, useChannels } from '@hooks/useJobs'
import { useToast } from '@components/Toast'
import { useAuthStore } from '@store/auth'
import { socialApi, schedulerApi, automationApi, voiceApi, notificationsApi, accountApi, type VoiceEntry, type VoiceGroup, type NotificationPrefs } from '@api/services'
import apiClient from '@api/client'

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

// ─── BYOK service definitions ─────────────────────────────────────────────────

const SERVICES: Array<{
  id: string
  name: string
  description: string
  docUrl: string
  placeholder: string
}> = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Script writing, SEO, AI insights',
    docUrl: 'https://console.anthropic.com/account/keys',
    placeholder: 'sk-ant-api03-...',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Premium AI voice narration',
    docUrl: 'https://elevenlabs.io/app/speech-synthesis/api',
    placeholder: 'el_...',
  },
  {
    id: 'pexels',
    name: 'Pexels',
    description: 'Stock footage and images',
    docUrl: 'https://www.pexels.com/api/new/',
    placeholder: 'Your Pexels API key',
  },
  {
    id: 'suno',
    name: 'Suno',
    description: 'AI music generation',
    docUrl: 'https://suno.com/account',
    placeholder: 'Your Suno API key',
  },
  {
    id: 'mureka',
    name: 'Mureka',
    description: 'AI music generation (alternative)',
    docUrl: 'https://mureka.ai/dashboard',
    placeholder: 'Your Mureka API key',
  },
  {
    id: 'kling',
    name: 'Kling AI',
    description: 'AI video generation for animated content',
    docUrl: 'https://klingai.com/dev/docs',
    placeholder: 'Your Kling API key',
  },
  {
    id: 'minimax',
    name: 'Minimax',
    description: 'AI video generation (alternative)',
    docUrl: 'https://www.minimaxi.com/en/document/guide',
    placeholder: 'Your Minimax API key',
  },
]

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

function ServiceRow({
  service,
  isSet,
  onSave,
  onRemove,
}: {
  service: typeof SERVICES[0]
  isSet: boolean
  onSave: (key: string) => Promise<void>
  onRemove: () => Promise<void>
}) {
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
          {!isSet && (
            <p className="text-[11px] text-[#A3A3A3] mt-2">
              Get your key at{' '}
              <a href={service.docUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#525252]">
                {service.docUrl.replace('https://', '').split('/')[0]}
              </a>
            </p>
          )}
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

  // Only count the services shown in this UI — `status` also includes
  // `kling_secret` (a paired credential, not its own visible row), which was
  // previously included in this count and could make it appear that all
  // services were connected even when one (e.g. Mureka) was actually "Not set".
  const connectedCount = SERVICES.filter((s) => (status as Record<string, boolean>)[s.id]).length

  const handleSave = async (serviceId: string, key: string) => {
    try {
      await saveMutation.mutateAsync({ service: serviceId, key })
      toast.success(`${SERVICES.find(s => s.id === serviceId)?.name} key saved`)
    } catch {
      toast.error('Failed to save — check the key is valid')
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
              onSave={(key) => handleSave(service.id, key)}
              onRemove={() => handleRemove(service.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

const INTEGRATIONS = [
  { id: 'youtube',  name: 'YouTube',       description: 'Upload and manage videos',  connected: true  },
  { id: 'r2',       name: 'Cloudflare R2', description: 'Video storage and CDN',     connected: false },
  { id: 'supabase', name: 'Supabase',      description: 'Auth and database',         connected: true  },
]

function IntegrationsTab() {
  const [state, setState] = useState(INTEGRATIONS)
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Integrations</h2>
      <p className="text-[12px] text-[#525252] mb-5">Connected platforms and infrastructure.</p>
      <div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
        {state.map((int) => (
          <div key={int.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#E5E5E5] last:border-b-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${int.connected ? 'bg-[#16A34A]' : 'bg-[#D4D4D4]'}`} />
            <div className="flex-1">
              <p className="text-[13px] font-medium text-[#0A0A0A]">{int.name}</p>
              <p className="text-[11px] text-[#A3A3A3]">{int.description}</p>
            </div>
            <span className={`text-[11px] font-medium ${int.connected ? 'text-[#16A34A]' : 'text-[#A3A3A3]'}`}>
              {int.connected ? 'Connected' : 'Not connected'}
            </span>
            <button
              onClick={() => setState(state.map((s) => s.id === int.id ? { ...s, connected: !s.connected } : s))}
              className={`text-[11px] font-medium h-7 px-2.5 rounded border transition-colors ${
                int.connected
                  ? 'border-[#E5E5E5] text-[#525252] hover:border-[#DC2626] hover:text-[#DC2626]'
                  : 'border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white'
              }`}
            >
              {int.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Preferences Tab ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-[#0A0A0A]' : 'bg-[#D4D4D4]'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  )
}

function PreferencesTab() {
  // This tab's notification toggles duplicate NotificationsTab (which has real
  // API persistence). Route users there instead of silently swallowing changes.
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Preferences</h2>
      <p className="text-[12px] text-[#525252] mb-5">Notification settings.</p>
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
    subtitle: 'Channel video posts',
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
    subtitle: 'Coming soon — video posts',
    hint: 'https://developer.x.com/en/docs/twitter-api',
    fields: [],
    comingSoon: true,
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    subtitle: 'Coming soon — video pins',
    hint: 'https://developers.pinterest.com/docs/',
    fields: [],
    comingSoon: true,
  },
]

function SocialPlatformRow({
  platform, connected, stats, channelSlug, onSave, onRemove,
}: {
  platform: SocialPlatformDef
  connected: boolean
  stats?: { recent_posts_count?: number; total_views?: number }
  channelSlug: string
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
              channelSlug={channelSlug}
              onSave={(config) => handleSave(platform.id, config)}
              onRemove={() => handleRemove(platform.id)}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-[#A3A3A3] mt-4">
        Credentials are stored encrypted (AES-256-GCM). Reddit posts YouTube links only — video upload coming in a future update.
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

  const runNext = useMutation({
    mutationFn: () => schedulerApi.runNext(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-status'] })
      queryClient.invalidateQueries({ queryKey: ['scheduler-history'] })
      toast.success('Job queued — pipeline starting now')
    },
    onError: () => toast.error('Failed to run next job'),
  })

  const testRun = useMutation({
    mutationFn: () => schedulerApi.testRun(),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-status'] })
      queryClient.invalidateQueries({ queryKey: ['scheduler-history'] })
      toast.success(res?.message ?? 'Test run triggered — check Jobs for progress')
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
            <strong>Separate</strong> — Claude writes a purpose-built 60-second Short script on the same topic. Better hook, native vertical content.&nbsp;
            <strong>Extract</strong> — clips are sliced from the main video's segments. No extra AI cost, but content was written for long-form.
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
      const msg = err?.response?.data?.detail || 'Failed to send test email'
      toast.error(msg)
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

const PLAN_LABELS: Record<string, string> = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise', unlimited: 'Unlimited' }
const PLAN_LIMITS: Record<string, number> = { free: 5, pro: 50, enterprise: 9999, unlimited: 9999 }

function AccountTab() {
  const toast = useToast()
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // logout() only clears store/token state — it never redirects. Without this,
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
      toast.error(e?.response?.data?.detail || 'Failed to delete account')
      setDeleting(false)
    }
  }

  if (profileLoading) {
    return <div className="flex items-center gap-2 text-[#A3A3A3] text-sm py-8"><Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> Loading…</div>
  }

  const email = profile?.email || ''
  const plan  = profile?.plan  || 'free'
  const used  = profile?.videos_used_this_month || 0
  const limit = PLAN_LIMITS[plan] ?? 5
  const usagePct = limit >= 9999 ? 0 : Math.min(100, Math.round(used / limit * 100))

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

        {/* Usage bar (only for free/pro) */}
        {limit < 9999 && (
          <div>
            <div className="flex justify-between text-[11px] text-[#A3A3A3] mb-1.5">
              <span>Monthly videos</span>
              <span className="tabular-nums text-[#0A0A0A] font-medium">{used} / {limit}</span>
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
              This permanently removes your Vidora account data. Your Supabase auth record will remain — contact support if you need it fully deleted.
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
  const [assigning, setAssigning] = useState<string | null>(null)

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

  const groups: VoiceGroup[] = voiceData?.groups ?? []
  const activeGroup = groups.find(g => g.id === selectedGroup)
  const filteredVoices: VoiceEntry[] = (activeGroup?.voices ?? []).filter(v => {
    if (genderFilter === 'all') return true
    return v.gender === genderFilter
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
              onClick={() => setProvider(p)}
              className={[
                'flex-1 border rounded-lg p-3.5 text-left transition-colors',
                provider === p
                  ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                  : 'border-[#E5E5E5] bg-white text-[#525252] hover:border-[#A3A3A3]',
              ].join(' ')}
            >
              <p className={`text-[13px] font-semibold ${provider === p ? 'text-white' : 'text-[#0A0A0A]'}`}>
                {p === 'edge' ? 'Edge TTS' : 'ElevenLabs'}
              </p>
              <p className={`text-[11px] mt-0.5 ${provider === p ? 'text-white/70' : 'text-[#A3A3A3]'}`}>
                {p === 'edge' ? 'Free · 40+ languages · 150+ voices' : 'Premium AI · Ultra-realistic · Requires API key'}
              </p>
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
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0A0A0A]">Edge TTS Voice Browser</h2>
            <p className="text-[12px] text-[#525252] mt-0.5">Browse and assign voices to channels.</p>
          </div>
          <div className="flex items-center gap-2">
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
                  className={[
                    'border rounded-lg p-3 flex flex-col gap-2 transition-colors',
                    isAssigned ? 'border-[#0A0A0A] bg-[#F5F5F5]' : 'border-[#E5E5E5] bg-white hover:border-[#A3A3A3]',
                  ].join(' ')}
                >
                  {/* Name row */}
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-[13px] font-medium text-[#0A0A0A] leading-tight">{voice.name}</p>
                    {voice.gender && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${
                        voice.gender === 'female' ? 'bg-[#FDF2F8] text-[#9D174D]' : 'bg-[#EFF6FF] text-[#1E40AF]'
                      }`}>{voice.gender === 'female' ? '♀' : '♂'}</span>
                    )}
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
  const [activeTab, setActiveTab] = useState<Tab>('api-keys')

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
      <div className="flex border-b border-[#E5E5E5] mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
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

      {content[activeTab]}
    </div>
  )
}
