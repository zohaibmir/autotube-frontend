import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { gotoAuthed, gotoAuthedAs, hasRole, type E2ERole } from './helpers'

const source = '/test-output/source.mp4'
const thumbnail = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')

async function mockClipPlayback(page: Page) {
  const video = execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=96x160:r=10:d=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1'])
  await page.route('**/api/studio/assets/*/preview-url', route => route.fulfill({ json: {
    ok: true, url: '/api/studio/assets/test-preview/file?token=test-only', expires_in: 600,
  } }))
  await page.route('**/api/studio/assets/test-preview/file?token=test-only', route => route.fulfill({
    contentType: 'video/mp4', body: video,
  }))
}

async function expectPlayingClip(page: Page, label: string) {
  await page.getByRole('button', { name: `Play ${label}`, exact: true }).click()
  const player = page.locator(`video[aria-label="Preview ${label}"]`)
  await expect(player).toBeVisible()
  await player.evaluate(async (element: HTMLVideoElement) => { await element.play() })
  await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0.1)
  await player.evaluate((element: HTMLVideoElement) => element.pause())
}

async function mockInputs(page: Page) {
  await page.route('**/api/channels', route => route.fulfill({ json: {
    ok: true, channels: [{ slug: 'mine', name: 'WildFactBook', is_default: true },
      { slug: 'other', name: 'Other channel' }],
  } }))
  await page.route('**/api/studio/videos', route => route.fulfill({ json: {
    ok: true, videos: [{ path: source, name: 'source.mp4', dir: '/test-output',
      size_mb: 2, mtime: Date.now() / 1000 }],
  } }))
  await page.route('**/api/studio/info/**', route => route.fulfill({ json: {
    ok: true, duration: 120, duration_str: '2:00', width: 1080, height: 1920, size_mb: 2,
  } }))
}

test('upload requires a source and displays real API errors rather than doing nothing', async ({ page }) => {
  await mockInputs(page)
  let payload: Record<string, unknown> | null = null
  await page.route('**/api/studio/upload-main', async route => {
    payload = route.request().postDataJSON()
    await route.fulfill({ status: 409, json: { detail: 'Reconnect this YouTube channel.' } })
  })
  await gotoAuthed(page, '/app/studio?tab=tools&tool=upload')
  const upload = page.getByRole('tabpanel').getByRole('button', { name: 'Upload to YouTube', exact: true })
  await page.getByRole('textbox', { name: 'Video title' }).fill('Brain cleaning')
  await expect(upload).toBeDisabled()
  await expect(page.getByText('Choose a rendered video from the video list, or add a file below.')).toBeVisible()
  await page.getByRole('button', { name: /source.mp4/ }).click()
  await page.getByLabel('YouTube visibility', { exact: true }).selectOption('private')
  await page.getByLabel('Notify subscribers', { exact: true }).uncheck()
  await expect(upload).toBeEnabled()
  await upload.click()
  await expect(page.getByRole('tabpanel').getByRole('alert')).toContainText('Reconnect this YouTube channel.')
  expect(payload).toMatchObject({ video_path: source, title: 'Brain cleaning', channel: 'mine',
    privacy_status: 'private', notify_subscribers: false })
})

test('adding a computer file opens Content review without publishing', async ({ page }) => {
  await mockInputs(page)
  let publications = 0
  await page.route('**/api/studio/upload-main', async route => {
    publications += 1
    await route.fulfill({ status: 500 })
  })
  await page.route('**/api/studio/assets', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().headers()['content-type']).toContain('multipart/form-data')
      await route.fulfill({ json: { ok: true, asset: { public_id: 'uploaded-file' } } })
    } else await route.fulfill({ json: { ok: true, assets: [], count: 0 } })
  })
  await page.route('**/api/studio/assets/uploaded-file', route => route.fulfill({ json: {
    ok: true, asset: { public_id: 'uploaded-file', title: 'My video', status: 'draft' }, publications: [],
  } }))
  await gotoAuthed(page, '/app/studio?tab=tools&tool=upload')
  await page.getByLabel('Add a video from your computer').setInputFiles({
    name: 'my-video.mp4', mimeType: 'video/mp4', buffer: Buffer.from('mock video upload'),
  })
  await expect(page).toHaveURL(/\/app\/studio\?asset=uploaded-file/)
  expect(publications).toBe(0)
})

test('upload previews a thumbnail and retries a refused cover without duplicating the video', async ({ page }) => {
  await mockInputs(page)
  let uploads = 0
  let retries = 0
  await page.route('**/api/studio/upload-main', async route => {
    uploads++
    expect(route.request().postDataJSON().thumbnail_data).toBe(`data:image/png;base64,${thumbnail.toString('base64')}`)
    await route.fulfill({ json: { ok: true, video_id: 'abcdefghijk',
      url: 'https://www.youtube.com/watch?v=abcdefghijk',
      thumbnail: { ok: false, detail: 'Video is still processing.' },
    } })
  })
  await page.route('**/api/youtube/set-thumbnail', async route => {
    retries++
    expect(route.request().postDataJSON()).toMatchObject({ video_id: 'abcdefghijk', channel_slug: 'mine' })
    await route.fulfill({ json: { ok: true, video_id: 'abcdefghijk' } })
  })
  await gotoAuthed(page, '/app/studio?tab=tools&tool=upload')
  await page.getByRole('button', { name: /source.mp4/ }).click()
  await page.getByLabel('Video title').fill('Review cover')
  await page.getByLabel('YouTube thumbnail (optional)').setInputFiles({
    name: 'cover.gif', mimeType: 'image/gif', buffer: Buffer.from('not a PNG'),
  })
  await expect(page.getByRole('alert')).toContainText('JPEG or PNG')
  await page.getByLabel('YouTube thumbnail (optional)').setInputFiles({
    name: 'cover.png', mimeType: 'image/png', buffer: thumbnail,
  })
  await expect(page.getByAltText('Selected YouTube thumbnail')).toBeVisible()
  await page.getByRole('tabpanel').getByRole('button', { name: 'Upload to YouTube', exact: true }).click()
  await expect(page.getByText(/Video uploaded, but thumbnail was not applied/)).toBeVisible()
  await expect(page.getByRole('tabpanel').getByRole('button', { name: 'Upload to YouTube', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Retry thumbnail only' }).click()
  await expect(page.getByText(/Video uploaded; thumbnail accepted by YouTube/)).toBeVisible()
  expect(uploads).toBe(1)
  expect(retries).toBe(1)
})

test('clip extraction validates times and enables first upload after success', async ({ page }) => {
  await mockInputs(page)
  await mockClipPlayback(page)
  let renders = 0
  let uploads = 0
  await page.route('**/api/studio/extract-clips', async route => {
    renders += 1
    await route.fulfill({ json: { ok: true, clips: [{
      label: 'clip-1', path: '/test-output/clips/clip.mp4', duration: 30, size_mb: 1, asset_id: 'clip-result',
    }] } })
  })
  await page.route('**/api/studio/upload-clips', async route => {
    uploads += 1
    await route.fulfill({ json: { ok: false, results: { youtube_shorts: [{
      path: '/test-output/clips/clip.mp4', error: 'YouTube refused this upload',
    }] } } })
  })
  await gotoAuthed(page, '/app/studio?tab=tools&tool=extract')
  await page.getByRole('button', { name: /source.mp4/ }).click()
  await page.getByLabel('Clip 1 end seconds').fill('0')
  const extract = page.getByRole('tabpanel').getByRole('button', { name: 'Extract Clips', exact: true })
  await extract.click()
  await expect(page.getByText(/Use valid start\/end seconds/)).toBeVisible()
  expect(renders).toBe(0)
  await page.getByLabel('Clip 1 end seconds').fill('30')
  await extract.click()
  await expectPlayingClip(page, 'clip-1')
  await page.locator('video[aria-label="Preview clip-1"]').dispatchEvent('error')
  await expect(page.getByRole('tabpanel').getByRole('alert')).toContainText('preview link expired')
  await expectPlayingClip(page, 'clip-1')
  const upload = page.getByRole('button', { name: 'Upload to Shorts', exact: true })
  await expect(upload).toBeEnabled()
  await upload.click()
  await expect(page.getByText(/0\/1 uploaded.*YouTube refused this upload/).first()).toBeVisible()
  expect(uploads).toBe(1)
})

test('Import displays analysis errors and extracted clips on the same tool', async ({ page }) => {
  await mockInputs(page)
  await mockClipPlayback(page)
  let analyses = 0
  let extractedUrl = ''
  await page.route('**/api/studio/import/analyze', async route => {
    analyses += 1
    await route.fulfill({ json: analyses === 1
      ? { ok: false, error: 'No captions available.' }
      : { ok: true, title: 'Brain cleaning', suggested_clips: [
        { start: 5, end: 25, label: 'Brain fact', reason: 'One complete idea' },
      ] } })
  })
  await page.route('**/api/studio/import/extract', async route => {
    extractedUrl = route.request().postDataJSON().url
    await route.fulfill({ json: { ok: true, clips: [{
      label: 'Brain fact', duration: 20, size_mb: 1, path: '/output/import.mp4', asset_id: 'import-result',
    }] } })
  })
  await gotoAuthed(page, '/app/studio?tab=tools&tool=import')
  await page.getByPlaceholder('https://www.youtube.com/watch?v=…').fill('https://www.youtube.com/shorts/WxUMiBqZJTQ')
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.getByRole('tabpanel').getByRole('alert')).toContainText('No captions available.')
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await page.getByRole('button', { name: 'Extract Selected (1)' }).click()
  await expect(page.getByRole('link', { name: 'Review Brain fact in Content' })).toHaveAttribute('href', '/app/studio?asset=import-result')
  await expectPlayingClip(page, 'Brain fact')
  expect(extractedUrl).toContain('WxUMiBqZJTQ')
})

test('Brand Kit loads explicit default channel once, saves clears and switches channels', async ({ page }) => {
  await mockInputs(page)
  const gets: string[] = []
  let saveAttempts = 0
  let saved: Record<string, unknown> | null = null
  await page.route('**/api/brand-kit**', async route => {
    if (route.request().method() === 'PUT') {
      if (++saveAttempts === 1) {
        await route.fulfill({ status: 503, json: { detail: 'Temporary save failure' } })
        return
      }
      saved = route.request().postDataJSON()
      await route.fulfill({ json: { ...saved, channel_slug: saved?.channel } })
    } else {
      const channel = new URL(route.request().url()).searchParams.get('channel')
      expect(channel).toBeTruthy()
      gets.push(channel!)
      await route.fulfill({ json: { channel_slug: channel, avatar_url: 'https://example.com/avatar.png', thumbnail_template: 'default' } })
    }
  })
  await page.route('**/api/voices/list', route => route.fulfill({ json: {
    groups: [{ voices: [{ id: 'voice-one', name: 'Narrator' }] }],
  } }))
  await page.route('**/api/channels/*/voice', route => route.fulfill({ json: { ok: true, voice_id: null } }))
  await gotoAuthed(page, '/app/studio?tab=tools&tool=brandkit')
  await expect(page.getByLabel('Avatar URL', { exact: true })).toHaveValue('https://example.com/avatar.png')
  const initialGets = gets.length
  await page.getByLabel('Avatar URL', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Save brand kit', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Temporary save failure')
  await expect(page.getByLabel('Avatar URL', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Save brand kit', exact: true }).click()
  await expect.poll(() => saved).toMatchObject({ channel: 'mine', avatar_url: '' })
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()
  expect(gets).toHaveLength(initialGets)
  expect(initialGets).toBeLessThanOrEqual(2) // React StrictMode mounts effects twice in development.
  await page.getByLabel('Destination channel').selectOption('other')
  await expect.poll(() => gets[gets.length - 1]).toBe('other')
  await expect(page).toHaveURL(/tool=brandkit/)
})

for (const role of ['admin', 'user_a'] satisfies E2ERole[]) {
  test(`Brand Kit prerequisites are usable as ${role} without an empty-channel request`, async ({ page }) => {
    test.skip(!hasRole(role), `Missing ${role} test credentials`)
    const invalidCalls: string[] = []
    await page.route('**/api/brand-kit**', async route => {
      const channel = new URL(route.request().url()).searchParams.get('channel')
      if (!channel) invalidCalls.push(route.request().url())
      await route.continue()
    })
    await gotoAuthedAs(page, role, '/app/studio?tab=tools&tool=brandkit')
    const select = page.getByLabel('Destination channel')
    await expect(select).toBeVisible()
    await expect(page.getByText('Choose a connected channel above to load its brand kit.')
      .or(page.getByRole('button', { name: 'Saved', exact: true }))).toBeVisible()
    expect(invalidCalls).toEqual([])
  })
}

test('tools remain readable on mobile and support keyboard tool switching', async ({ page }, testInfo) => {
  await mockInputs(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoAuthed(page, '/app/studio?tab=tools&tool=import')
  const importTab = page.getByRole('tab', { name: /Import & Clip/ })
  await expect(importTab).toHaveAttribute('aria-selected', 'true')
  await importTab.focus()
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: /Thumbnail A\/B/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/tool=thumbnailAb/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  const panel = await page.getByRole('tabpanel').boundingBox()
  expect(panel?.width).toBeGreaterThan(350)
  const input = page.getByRole('textbox', { name: 'Thumbnail test video ID' })
  await input.scrollIntoViewIfNeeded()
  await expect(input).toBeInViewport()
  const inputBounds = await input.boundingBox()
  expect(inputBounds!.x + inputBounds!.width).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden()
  await page.screenshot({ path: testInfo.outputPath('studio-tools-mobile.png'), fullPage: true })
})

test('all five tools keep their controls inside the panel on desktop and mobile', async ({ page }, testInfo) => {
  await mockInputs(page)
  await page.route('**/api/brand-kit**', route => route.fulfill({ json: {
    channel_slug: 'mine', thumbnail_template: 'default',
  } }))
  await page.route('**/api/voices/list', route => route.fulfill({ json: { groups: [] } }))
  await page.route('**/api/channels/*/voice', route => route.fulfill({ json: { ok: true, voice_id: null } }))
  await gotoAuthed(page, '/app/studio?tab=tools&tool=upload')
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [tool, label] of [
      ['upload', /Upload to YouTube/], ['extract', /Extract Clips/], ['import', /Import & Clip/],
      ['brandkit', /Brand Kit/], ['thumbnailAb', /Thumbnail A\/B/],
    ] as const) {
      await page.getByRole('tab', { name: label }).click()
      const panel = page.getByRole('tabpanel')
      await expect(panel).toBeVisible()
      const controls = panel.locator('input:visible, select:visible, textarea:visible, button:visible')
      for (const control of await controls.all()) {
        const bounds = await control.boundingBox()
        expect(bounds?.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
      }
      await panel.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`${tool}-${width}.png`), fullPage: true })
    }
  }
})
