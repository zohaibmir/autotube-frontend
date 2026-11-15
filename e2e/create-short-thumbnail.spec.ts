import { test, expect } from '@playwright/test'
import { gotoAuthed } from './helpers'

const cover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='

test('Create wizard submits the exact designed cover and channel through the Short endpoint', async ({ page }) => {
  let payload: Record<string, unknown> | null = null
  await page.route('**/api/shorts/script/run', async route => {
    payload = route.request().postDataJSON()
    await route.fulfill({ json: { ok: true } })
  })
  await page.addInitScript(({ cover }) => {
    localStorage.setItem('yt-create-workspace', JSON.stringify({
      state: {
        contentType: 'short', channelSlug: 'mine', shortsDurationSeconds: 120,
        selectedTopic: { topic: 'Elephants mourn their dead' },
        scriptContent: 'A complete elephant narration',
        thumbnailData: { dataUrl: cover },
      },
      version: 0,
    }))
  }, { cover })
  await gotoAuthed(page, '/app/create/submit')
  await expect(page.getByRole('img', { name: 'Thumbnail', exact: true })).toHaveAttribute('src', cover)
  await page.getByRole('button', { name: 'Build Short', exact: true }).click()
  await expect.poll(() => payload).not.toBeNull()
  expect(payload).toMatchObject({
    thumbDataUrl: cover, channel_slug: 'mine', duration_seconds: 120,
    scriptText: 'A complete elephant narration',
  })
})

test('job distinguishes cover acceptance from upload success and retries only the saved cover', async ({ page }) => {
  let retried: Record<string, unknown> | null = null
  let videoUploads = 0
  const job = {
    job_id: 'cover-job', topic: '[Short] Elephants', status: 'done',
    youtube_id: 'abcdefghijk', channel_slug: 'mine', progress: 100,
    events: [{ details: { short_preview: {
      thumbnail_data_url: cover,
      thumbnail: { ok: false, reason: 'processing_pending', detail: 'Video is not processed yet.' },
    } } }],
  }
  await page.route('**/api/pipeline/jobs*', route => route.fulfill({ json: { jobs: [job] } }))
  await page.route('**/api/pipeline/status', route => route.fulfill({ json: { status: 'idle' } }))
  await page.route('**/api/youtube/set-thumbnail', async route => {
    retried = route.request().postDataJSON()
    job.events[0].details.short_preview.thumbnail = { ok: true, reason: '', detail: '' }
    await route.fulfill({ json: { ok: true } })
  })
  await page.route('**/api/pipeline/upload', async route => {
    videoUploads += 1
    await route.fulfill({ status: 500, json: { detail: 'Must not upload another video' } })
  })
  await gotoAuthed(page, '/app/jobs/cover-job')
  await expect(page.getByText('Cover not applied: Video is not processed yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Reapply cover only', exact: true }).click()
  await expect.poll(() => retried).toMatchObject({
    video_id: 'abcdefghijk', thumbnail_data: cover, channel_slug: 'mine', job_id: 'cover-job',
  })
  await expect(page.getByText('Custom cover accepted by YouTube')).toBeVisible()
  expect(videoUploads).toBe(0)
})
