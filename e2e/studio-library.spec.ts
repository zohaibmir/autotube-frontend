/**
 * studio-library.spec.ts — the Creator Studio Content library.
 *
 * The library is the phase-1 surface of the Creator Studio plan: a creator's videos are the page,
 * and the drawer is where one video is edited. This spec drives that surface in a browser, with the
 * assets API mocked so it neither writes to the real library nor depends on what a developer happens
 * to have uploaded.
 *
 * What it pins:
 *   - Content is the default tab and the list is rendered from GET /api/studio/assets
 *   - an empty library invites the first upload instead of showing "no data"
 *   - a row opens the drawer, and Save PATCHes only the edited fields
 *   - an upload goes through POST /api/studio/assets, shows in the tray, and lands in the list
 *
 * Auth is real; everything else is fulfilled by `page.route`.
 */
import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { captureConsoleErrors, gotoAuthed, realErrors } from './helpers'

const READY = {
  id: 1,
  public_id: 'asset-ready-1',
  user_id: 'u1',
  kind: 'video',
  origin: 'upload',
  title: 'There Are Lakes Beneath the Antarctic Ice',
  description: '',
  tags: ['antarctica'],
  status: 'ready',
  duration_s: 62,
  width: 1080,
  height: 1920,
  source_bytes: 73_820_000,
  mime: 'video/mp4',
  channel_slug: 'truthnevershared',
  job_id: null,
  error: null,
  created_at: new Date(Date.now() - 3_600_000).toISOString(),
  updated_at: new Date(Date.now() - 3_600_000).toISOString(),
  file_url: '/api/studio/assets/asset-ready-1/file',
}

const DRAFT = {
  ...READY,
  id: 2,
  public_id: 'asset-draft-2',
  title: 'An untitled draft',
  status: 'draft',
  tags: [],
  created_at: new Date(Date.now() - 86_400_000).toISOString(),
}

const CHANNELS = {
  ok: true,
  channels: [{ slug: 'truthnevershared', name: 'WildFactBook' }],
}

// A 1×1 transparent PNG, so the drawer's <img> has real bytes to render.
const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

/** One route for the collection and one for an item, branched on the path. */
async function mockAssets(
  page: Page,
  opts: {
    assets: () => unknown[]
    onPatch?: (body: Record<string, unknown>) => void
    onPublish?: (body: Record<string, unknown>) => void
    publication?: () => Record<string, unknown> | null
    recovers?: () => unknown[]
    onRecover?: (jobId: string) => void
    onGenerate?: (body: Record<string, unknown>) => void
    onThumbnail?: (publicId: string) => void
  },
): Promise<void> {
  let patched: Record<string, unknown> | null = null
  const current = (): Array<Record<string, unknown>> => {
    const list = opts.assets() as Array<Record<string, unknown>>
    if (!patched) return list
    return list.map((a) => (a.public_id === patched!.public_id ? patched! : a))
  }

  await page.route('**/api/studio/assets**', async (route: Route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const parts = url.pathname.split('/')

    if (url.pathname === '/api/studio/assets') {
      if (method === 'GET') {
        const assets = current()
        return route.fulfill({ json: { ok: true, count: assets.length, assets } })
      }
      if (method === 'POST') {
        return route.fulfill({ json: { ok: true, asset: DRAFT } })
      }
    }

    if (url.pathname.endsWith('/preview-url') && method === 'POST') {
      const id = parts[4]
      const hasThumb = Boolean(current().find((a) => a.public_id === id)?.thumbnail_url)
      return route.fulfill({
        json: {
          ok: true,
          url: `/api/studio/assets/${id}/file?token=mock`,
          ...(hasThumb ? { thumbnail_url: `/api/studio/assets/${id}/thumbnail?token=mock` } : {}),
          expires_in: 600,
        },
      })
    }

    if (url.pathname.endsWith('/publications') && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}')
      opts.onPublish?.(body)
      return route.fulfill({
        json: {
          ok: true,
          job_id: 'job-publish-1',
          publication: opts.publication?.() ?? { status: 'publishing' },
        },
      })
    }

    if (url.pathname.startsWith('/api/studio/assets/')) {
      const id = parts[4]
      const sub = parts[5]

      if (sub === 'thumbnail' && method === 'POST') {
        opts.onThumbnail?.(id)
        const withThumb = {
          ...(current().find((a) => a.public_id === id) ?? READY),
          thumbnail_url: `/api/studio/assets/${id}/thumbnail`,
        }
        patched = withThumb
        return route.fulfill({ json: { ok: true, asset: withThumb } })
      }
      if (sub === 'thumbnail' && method === 'GET') {
        return route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG })
      }
      if (sub === 'file' && method === 'GET') {
        // The drawer's <video> preview is not under test here; a 404 is a benign resource error.
        return route.fulfill({ status: 404, json: { detail: 'file preview not mocked' } })
      }

      const asset = current().find((a) => a.public_id === id) ?? READY
      const publication = opts.publication?.() ?? null
      if (method === 'GET') {
        return route.fulfill({
          json: { ok: true, asset, publications: publication ? [publication] : [] },
        })
      }
      if (method === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}')
        opts.onPatch?.(body)
        // Mirror a real server: the item and the collection both reflect the change.
        patched = { ...asset, ...body }
        return route.fulfill({ json: { ok: true, asset: patched } })
      }
    }

    return route.fulfill({ status: 404, json: { detail: 'not mocked' } })
  })

  // Recoverable pipeline renders live under /api/studio/recoverable-renders, outside the assets path.
  await page.route('**/api/studio/recoverable-renders**', async (route: Route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()

    if (url.pathname === '/api/studio/recoverable-renders' && method === 'GET') {
      const renders = opts.recovers?.() ?? []
      return route.fulfill({ json: { ok: true, count: renders.length, renders } })
    }

    if (url.pathname.match(/^\/api\/studio\/recoverable-renders\/[^/]+$/) && method === 'POST') {
      const jobId = url.pathname.split('/').pop()!
      opts.onRecover?.(jobId)
      const asset = {
        id: 9,
        public_id: `asset-recovered-${jobId}`,
        user_id: 'u1',
        kind: 'video',
        origin: 'pipeline',
        title: 'Recovered render',
        description: '',
        tags: [],
        status: 'ready',
        duration_s: 60,
        width: 1080,
        height: 1920,
        source_bytes: 1000000,
        mime: 'video/mp4',
        channel_slug: 'truthnevershared',
        job_id: jobId,
        error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_url: `/api/studio/assets/asset-recovered-${jobId}/file`,
      }
      return route.fulfill({ json: { ok: true, asset, already_in_library: false } })
    }

    return route.fulfill({ status: 404, json: { detail: 'not mocked' } })
  })

  // AI metadata regeneration: seeded from the title, returns a description + tags.
  await page.route('**/api/studio/generate-metadata', async (route: Route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    opts.onGenerate?.(body)
    return route.fulfill({
      json: {
        ok: true,
        description: 'AI-written description of the Antarctic lakes.',
        tags: ['antarctica', 'lakes', 'science'],
        keywords: ['antarctica'],
        captions: { instagram: '', tiktok: '', facebook: '', linkedin: '' },
      },
    })
  })
  await page.route('**/api/channels**', (route) => route.fulfill({ json: CHANNELS }))
}

test.describe('Creator Studio — Content library', () => {
  test('lists the videos and opens one in the drawer', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    const patches: Array<Record<string, unknown>> = []
    await mockAssets(page, { assets: () => [READY, DRAFT], onPatch: (b) => patches.push(b) })

    await gotoAuthed(page, '/app/studio')

    // Content is the default tab, and the shell still offers Tools.
    await expect(page.getByRole('heading', { name: 'Your videos' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Tools' })).toBeVisible()

    await expect(page.getByText(READY.title)).toBeVisible()
    await expect(page.getByText(DRAFT.title)).toBeVisible()

    // Scope the status chips to their rows: "Ready" is also a filter chip at the top.
    const readyRow = page.getByRole('button', { name: new RegExp(READY.title) })
    const draftRow = page.getByRole('button', { name: new RegExp(DRAFT.title) })
    await expect(readyRow.getByText('Ready', { exact: true })).toBeVisible()
    await expect(draftRow.getByText('Draft', { exact: true })).toBeVisible()

    // Open the drawer: the row is a link to the asset, and the URL says so.
    await readyRow.click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('heading', { level: 2 })).toHaveText(READY.title)
    await expect(page).toHaveURL(/asset=asset-ready-1/)

    // Edit the title and save: only the edited field is sent.
    await page.locator('#asset-title').fill('Ice lakes — edited')
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect.poll(() => patches.length).toBe(1)
    expect(patches[0]).toMatchObject({ title: 'Ice lakes — edited' })
    expect(patches[0]).not.toHaveProperty('description')
    await expect(page.getByText('Video saved')).toBeVisible()

    // Closing drops the query param, so Back closes the drawer rather than leaving the page.
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(drawer).toBeHidden()
    await expect(page).not.toHaveURL(/asset=/)

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('the + Create menu lists every creation flow', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await mockAssets(page, { assets: () => [READY] })

    await gotoAuthed(page, '/app/studio')
    await expect(page.getByRole('heading', { name: 'Your videos' })).toBeVisible({ timeout: 20_000 })

    const create = page.getByRole('button', { name: 'Create', exact: true })
    await expect(create).toBeVisible()
    await create.click()

    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    for (const label of [
      'AI long-form video',
      'AI Short — animated',
      'AI Short — from a script',
      'Assemble from my clips',
      'Repurpose a video',
      'Kids video',
    ]) {
      await expect(menu.getByRole('menuitem', { name: new RegExp(label) })).toBeVisible()
    }

    // Clicking outside closes it.
    await page.getByRole('heading', { name: 'Your videos' }).click()
    await expect(menu).toBeHidden()

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('shows a rendering row for a video in flight', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await mockAssets(page, { assets: () => [READY] })

    // A pipeline job still rendering is not an asset yet — it is shown as a row above the list.
    await page.route('**/api/pipeline/jobs', async (route: Route) => {
      return route.fulfill({
        json: {
          ok: true,
          jobs: [
            { job_id: 'job-running-1', topic: 'Why Ice Floats', status: 'running', progress: 42 },
          ],
        },
      })
    })

    await gotoAuthed(page, '/app/studio')
    await expect(page.getByRole('heading', { name: 'Your videos' })).toBeVisible({ timeout: 20_000 })

    await expect(page.getByRole('heading', { name: 'Rendering' })).toBeVisible()
    await expect(page.getByText('Why Ice Floats')).toBeVisible()
    await expect(page.getByText(/Rendering · 42%/)).toBeVisible()

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('regenerates description and tags with AI from the title', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    const generates: Array<Record<string, unknown>> = []
    await mockAssets(page, { assets: () => [READY], onGenerate: (b) => generates.push(b) })

    await gotoAuthed(page, '/app/studio?asset=asset-ready-1')

    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()

    // The AI action lives in the Description header; it seeds from the current title.
    await drawer.getByRole('button', { name: /regenerate/i }).click()

    // The response fills both the description and the tags.
    await expect(page.locator('#asset-description')).toHaveValue(
      'AI-written description of the Antarctic lakes.',
    )
    await expect(page.locator('#asset-tags')).toHaveValue('antarctica, lakes, science')
    expect(generates).toHaveLength(1)
    expect(generates[0]).toMatchObject({ title: READY.title })

    // AI output is a suggestion, not auto-saved: the footer flags it as unsaved.
    await expect(page.getByText('Unsaved changes')).toBeVisible()

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('generates a thumbnail from a frame of the video', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    const thumbnails: string[] = []
    await mockAssets(page, { assets: () => [READY], onThumbnail: (id) => thumbnails.push(id) })

    await gotoAuthed(page, '/app/studio?asset=asset-ready-1')

    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()

    // No thumbnail yet — the cover image is generated on demand.
    await expect(drawer.getByText('No thumbnail yet')).toBeVisible()

    await drawer.getByRole('button', { name: 'Generate', exact: true }).click()

    // The endpoint is called for this asset, the image renders, and the button flips to Regenerate.
    await expect(drawer.locator('img[alt="Thumbnail"]')).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Regenerate', exact: true })).toBeVisible()
    expect(thumbnails).toEqual(['asset-ready-1'])
    await expect(page.getByText('Thumbnail generated')).toBeVisible()

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('an empty library invites the first upload', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await mockAssets(page, { assets: () => [] })

    await gotoAuthed(page, '/app/studio')

    await expect(page.getByText('Upload your first video')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /upload video/i })).toBeVisible()
    // The empty state names what is accepted instead of letting the user discover it by failing.
    await expect(page.getByText(/MP4, MOV, WebM, MKV and M4V/)).toBeVisible()

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('an uploaded file shows in the tray and then in the library', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    let uploaded = false
    await mockAssets(page, { assets: () => (uploaded ? [DRAFT, READY] : [READY]) })

    await gotoAuthed(page, '/app/studio')
    await expect(page.getByText(READY.title)).toBeVisible({ timeout: 20_000 })

    const created = page.waitForRequest(
      (r) => r.url().endsWith('/api/studio/assets') && r.method() === 'POST',
      { timeout: 20_000 },
    )
    await page.locator('input[type="file"]').setInputFiles({
      name: 'sample.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('mocked-body'),
    })
    const request = await created
    expect(request.headers()['content-type']).toContain('multipart/form-data')

    // The tray reports the file, and the list refreshes to include it.
    uploaded = true
    await expect(page.getByText('sample.mp4 added to your library')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(DRAFT.title)).toBeVisible({ timeout: 20_000 })

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })
})


test.describe('Creator Studio — publishing', () => {
  test('publishing goes through the job and shows the live result', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    let publication: Record<string, unknown> | null = null
    let publishBody: Record<string, unknown> | null = null

    await mockAssets(page, {
      assets: () => [READY],
      publication: () => publication,
      onPublish: (body) => {
        publishBody = body
        publication = {
          id: 5,
          asset_id: 1,
          platform: 'youtube',
          channel_slug: body.channel_slug || 'truthnevershared',
          status: 'publishing',
          external_id: null,
          attempt_count: 0,
          last_error: null,
          published_at: null,
        }
      },
    })

    await gotoAuthed(page, '/app/studio')
    await page.getByRole('button', { name: new RegExp(READY.title) }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()

    // Preflight is visible before the click, and the action is available.
    const publish = drawer.getByRole('button', { name: /publish now/i })
    await expect(publish).toBeEnabled()
    await expect(drawer.getByText(/to publish:/i)).toHaveCount(0)
    await publish.click()

    // The drawer publishes what is on screen and sends the chosen channel.
    await expect.poll(() => publishBody?.channel_slug).toBe('truthnevershared')
    expect(publishBody).toMatchObject({ privacy_status: 'public' })

    // The publication row drives the UI: first in-flight, then live.
    await expect(drawer.getByText(/uploading to youtube/i)).toBeVisible()
    publication = {
      ...(publication ?? {}),
      status: 'published',
      external_id: 'YT1',
      published_at: new Date().toISOString(),
    }
    await expect(drawer.getByText('Live on YouTube')).toBeVisible({ timeout: 15_000 })
    await expect(drawer.getByRole('link', { name: /view on youtube/i })).toHaveAttribute(
      'href',
      'https://youtu.be/YT1',
    )

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('publishing is blocked, with the reason, until a channel is chosen', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await mockAssets(page, {
      assets: () => [{ ...READY, channel_slug: null }],
      publication: () => null,
    })

    await gotoAuthed(page, '/app/studio')
    await page.getByRole('button', { name: new RegExp(READY.title) }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer.getByText(/to publish: choose a channel/i)).toBeVisible()
    await expect(drawer.getByRole('button', { name: /publish now/i })).toBeDisabled()

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('lists recoverable renders and recovers one into the library', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    let recoveredJobId: string | null = null
    const recovered = new Set<string>()
    const recovers = () =>
      [
        {
          job_id: 'job-failed-1',
          title: 'Failed upload render',
          status: 'error',
          channel_slug: 'truthnevershared',
          size_bytes: 50000000,
          start_time: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          job_id: 'job-interrupted-2',
          title: 'Interrupted render',
          status: 'interrupted',
          channel_slug: null,
          size_bytes: 30000000,
          start_time: new Date(Date.now() - 7200000).toISOString(),
        },
      ].filter((r) => !recovered.has(r.job_id))
    await mockAssets(page, {
      assets: () => [],
      recovers,
      onRecover: (jobId) => {
        recoveredJobId = jobId
        recovered.add(jobId)
      },
    })

    await gotoAuthed(page, '/app/studio')

    // Recovery section shows both failed renders.
    await expect(page.getByText('Recoverable renders')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Failed upload render')).toBeVisible()
    await expect(page.getByText('Interrupted render')).toBeVisible()

    // Recover the first one.
    await page.getByRole('button', { name: /recover/i }).first().click()
    await expect(page.getByText(/Failed upload render recovered and ready to publish/)).toBeVisible()
    expect(recoveredJobId).toBe('job-failed-1')

    // After recovery, the render disappears from the recoverable list.
    await expect(page.getByText('Failed upload render')).toHaveCount(0)
    await expect(page.getByText('Interrupted render')).toBeVisible()

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('recovering the same render twice is idempotent', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    const recoveries: string[] = []
    const recovered = new Set<string>()
    await mockAssets(page, {
      assets: () => [],
      recovers: () =>
        [
          {
            job_id: 'job-dupe-1',
            title: 'Duplicate recovery test',
            status: 'error',
            channel_slug: 'truthnevershared',
            size_bytes: 10000000,
            start_time: new Date().toISOString(),
          },
        ].filter((r) => !recovered.has(r.job_id)),
      onRecover: (jobId) => {
        recoveries.push(jobId)
        recovered.add(jobId)
      },
    })

    await gotoAuthed(page, '/app/studio')
    await expect(page.getByText('Recoverable renders')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: /recover/i }).first().click()
    await expect(page.getByText(/Duplicate recovery test recovered and ready to publish/)).toBeVisible()

    // The render should disappear from the recoverable list (idempotent).
    await expect(page.getByText('Duplicate recovery test')).toHaveCount(0)
    expect(recoveries).toEqual(['job-dupe-1'])

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })
})

