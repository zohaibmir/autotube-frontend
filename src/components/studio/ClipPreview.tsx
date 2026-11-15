import { useState } from 'react'
import { studioApi } from '@/api/services'
import apiClient from '@/api/client'
import { apiErrorMessage } from '@/lib/apiError'

export function ClipPreview({ assetId, label }: { assetId: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPreview() {
    setLoading(true)
    setError(null)
    try {
      const result = await studioApi.previewUrl(assetId)
      if (!result.ok || !result.url) throw new Error('Preview URL unavailable.')
      const base = (apiClient.defaults.baseURL || '').replace(/\/$/, '')
      setUrl(`${base}${result.url}`)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load clip preview.'))
    } finally {
      setLoading(false)
    }
  }

  return <div className="mt-3">
    {url && <video aria-label={`Preview ${label}`} src={url} controls playsInline preload="metadata"
      className="w-full max-h-80 rounded-lg bg-black"
      onError={() => { setUrl(null); setError('Playback failed or the preview link expired. Load a fresh preview below.') }} />}
    {error && <p role="alert" className="text-sm text-red-700 my-2">{error}</p>}
    {!url && <button type="button" disabled={loading} onClick={loadPreview}
      className="rounded-md border bg-white px-3 py-2 text-sm disabled:opacity-50">
      {loading ? 'Loading preview...' : `Play ${label}`}
    </button>}
  </div>
}
