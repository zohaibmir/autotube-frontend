import { test, expect } from '@playwright/test'
import { gotoAuthed } from './helpers'

const videoId = 'WxUMiBqZJTQ'
const cover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='

test('Studio imports an existing Short and applies uploaded cover bytes, not a local path', async ({ page }) => {
  let imported = false
  let hasBaseline = false
  let challenger: Record<string, unknown> | null = null
  const mutations: string[] = []
  await page.route('**/api/channels', route => route.fulfill({ json: {
    ok: true, channels: [{ slug: 'mine', name: 'WildFactBook', is_default: true }],
  } }))
  await page.route('**/api/thumbnail/ab/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'POST') {
      mutations.push(url.pathname)
      if (url.pathname.endsWith('/import')) {
        expect(request.postDataJSON()).toEqual({ channel_slug: 'mine' })
        imported = true
      } else if (url.pathname.endsWith('/baseline')) {
        hasBaseline = true
      } else if (url.pathname.endsWith('/challenger')) {
        challenger = request.postDataJSON()
      } else {
        throw new Error(`Unexpected mutation: ${url.pathname}`)
      }
    }
    if (!imported) {
      await route.fulfill({ status: 404, json: { detail: 'That video is not in your library.' } })
      return
    }
    await route.fulfill({ json: {
      video_id: videoId,
      variants: hasBaseline ? [{
        variant_id: 1, label: 'Original', set_at: null, retired_at: null,
        impressions: null, clicks: null, ctr_percent: null, partial: false,
      }] : [],
      readings: 0,
      verdict: { state: 'no_data', winner_variant_id: null, confidence: null,
        needed_per_variant: 1000, note: 'No CTR readings yet.' },
    } })
  })
  await gotoAuthed(page, '/app/studio?tab=tools')
  await page.getByRole('tab', { name: /Thumbnail A\/B/ }).click()
  await page.getByRole('textbox', { name: 'Thumbnail test video ID' }).fill(videoId)
  await page.getByRole('button', { name: 'Import existing YouTube video' }).click()
  await page.getByRole('button', { name: 'Register current as baseline' }).click()
  await expect(page.getByText('No CTR readings yet.')).toBeVisible()
  await page.getByLabel('Challenger cover', { exact: true }).setInputFiles({
    name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(cover.split(',')[1], 'base64'),
  })
  await expect(page.getByAltText('Challenger cover preview')).toHaveAttribute('src', cover)
  await page.getByRole('button', { name: 'Apply challenger', exact: true }).click()
  await expect.poll(() => challenger).toMatchObject({ thumbnail_data: cover })
  expect(challenger).not.toHaveProperty('image_path')
  expect(mutations).toEqual([
    `/api/thumbnail/ab/${videoId}/import`,
    `/api/thumbnail/ab/${videoId}/baseline`,
    `/api/thumbnail/ab/${videoId}/challenger`,
  ])
})

test('Studio applies a stored winning cover through the rotation endpoint', async ({ page }) => {
  let selected = false
  const mutations: string[] = []
  await page.route('**/api/thumbnail/ab/**', async route => {
    if (route.request().method() === 'POST') {
      mutations.push(new URL(route.request().url()).pathname)
      selected = true
    }
    await route.fulfill({ json: {
      video_id: videoId, readings: 5,
      variants: [{
        variant_id: 7, label: 'Bold', set_at: '2026-01-01', retired_at: selected ? null : '2026-01-02',
        impressions: 10000, clicks: 500, ctr_percent: 5, partial: false, image_data: cover,
      }],
      verdict: { state: 'winner', winner_variant_id: 7, confidence: 0.99,
        needed_per_variant: 1000, note: 'Sequential-window comparison.' },
    } })
  })
  await gotoAuthed(page, '/app/studio?tab=tools')
  await page.getByRole('tab', { name: /Thumbnail A\/B/ }).click()
  await page.getByRole('textbox', { name: 'Thumbnail test video ID' }).fill(videoId)
  await expect(page.getByRole('img', { name: 'Bold', exact: true })).toHaveAttribute('src', cover)
  await page.getByRole('button', { name: 'Apply winning cover' }).click()
  await expect.poll(() => mutations).toEqual([`/api/thumbnail/ab/${videoId}/select/7`])
  await expect(page.getByRole('button', { name: 'Apply winning cover' })).toBeDisabled()
})

test('Analytics submits generated portrait image bytes instead of the server image path', async ({ page }) => {
  let hasBaseline = false
  let generated: Record<string, unknown> | null = null
  let challenger: Record<string, unknown> | null = null
  await page.route('**/api/thumbnail/generate', async route => {
    generated = route.request().postDataJSON()
    await route.fulfill({ json: { ok: true, mime: 'image/png', b64: cover.split(',')[1],
      path: '/server-only/generated.png', width: 1080, height: 1920 } })
  })
  await page.route('**/api/thumbnail/ab/**', async route => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'POST') {
      if (url.pathname.endsWith('/baseline')) hasBaseline = true
      else if (url.pathname.endsWith('/challenger')) challenger = route.request().postDataJSON()
      else throw new Error(`Unexpected mutation: ${url.pathname}`)
    }
    await route.fulfill({ json: {
      video_id: videoId, readings: 0,
      variants: hasBaseline ? [{
        variant_id: 1, label: 'Original', set_at: null, retired_at: null,
        impressions: null, clicks: null, ctr_percent: null, partial: false,
      }] : [],
      verdict: { state: 'no_data', winner_variant_id: null, confidence: null,
        needed_per_variant: 1000, note: 'No CTR readings yet.' },
    } })
  })
  await gotoAuthed(page, '/app/analytics')
  await page.getByPlaceholder('Paste a video ID (11 characters)').fill(videoId)
  await page.getByRole('button', { name: 'Load', exact: true }).click()
  await page.getByRole('button', { name: 'Register current as baseline' }).click()
  await page.getByPlaceholder('e.g. How to grow tomatoes').fill('Your brain cleans itself during sleep')
  await page.getByRole('button', { name: '9:16', exact: true }).click()
  await page.getByRole('button', { name: 'Generate thumbnail', exact: true }).click()
  await expect(page.getByRole('img', { name: 'preview', exact: true })).toHaveAttribute('src', cover)
  expect(generated).toMatchObject({ aspect: 'vertical' })
  await page.getByRole('button', { name: 'Set live', exact: true }).click()
  await expect.poll(() => challenger).toMatchObject({ thumbnail_data: cover })
  expect(challenger).not.toHaveProperty('image_path')
})
