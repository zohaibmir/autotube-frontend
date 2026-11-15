import { test, expect } from '@playwright/test'
import { gotoAuthed } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/channel-profiles/*', route => route.fulfill({
    json: { ok: true, profile: { shorts_duration_seconds: 120 } },
  }))
})

test('Script Short uploads the portrait preview bytes privately with free narration', async ({ page }) => {
  let payload: Record<string, unknown> = {}
  let submitted = false
  await page.route('**/api/shorts/script/run', async route => {
    payload = route.request().postDataJSON() as Record<string, unknown>
    submitted = true
    await route.fulfill({ json: { ok: true } })
  })
  await page.route('**/api/shorts/script/status', route => route.fulfill({
    json: submitted ? {
      status: 'done', youtube_id: 'abcdefghijk', channel_slug: 'mine',
      privacy_status: 'private', thumbnail_data_url: payload.thumbDataUrl,
      thumbnail: { ok: true, detail: '' }, message: 'Private review ready',
    } : { status: 'idle' },
  }))
  await gotoAuthed(page, '/app/shorts')
  await page.getByRole('button', { name: /Script Short.*Voice narration/ }).click()
  await page.getByPlaceholder('e.g. 3 Facts About the Ocean').fill('Why octopuses have three hearts')
  await page.getByPlaceholder('Hook: One specific, truthful surprise.', { exact: false }).fill(
    'Three hearts. One octopus. Two hearts pump through the gills; the third supplies the body.',
  )
  await page.getByLabel('Cover headline', { exact: true }).fill('THREE HEARTS?')
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 400
    const context = canvas.getContext('2d')!
    context.fillStyle = '#164e63'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.locator('input[type="file"]').setInputFiles({
    name: 'octopus-background.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  })
  const preview = page.getByRole('img', { name: '9:16 cover preview' })
  await expect(preview).toBeVisible()
  const source = await preview.getAttribute('src')
  expect(await preview.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight]))
    .toEqual([1080, 1920])
  await expect(page.getByLabel('Upload visibility')).toHaveValue('private')
  await page.getByRole('button', { name: 'Build & Upload private Short' }).click()
  await expect(page.getByText('Private review ready')).toBeVisible()
  expect(payload.thumbDataUrl).toBe(source)
  expect(payload.privacy_status).toBe('private')
  expect(payload.visualSource).toBe('stock')
  expect(payload.tts_provider).toBe('edge')
  expect(payload.captions_enabled).toBe(true)
  expect(payload.duration_seconds).toBe(120)
})

test('public publication needs confirmation again after the script changes', async ({ page }) => {
  await page.route('**/api/shorts/script/status', route => route.fulfill({ json: { status: 'idle' } }))
  await gotoAuthed(page, '/app/shorts')
  await page.getByRole('button', { name: /Script Short.*Voice narration/ }).click()
  await page.getByPlaceholder('e.g. 3 Facts About the Ocean').fill('Octopus hearts')
  const script = page.getByPlaceholder('Hook: One specific, truthful surprise.', { exact: false })
  await script.fill('Two hearts supply the gills. One supplies the body.')
  await page.getByLabel('Upload visibility').selectOption('public')
  const build = page.getByRole('button', { name: 'Build & Upload public Short' })
  await expect(build).toBeDisabled()
  await page.getByRole('checkbox', { name: /approve public publication/ }).check()
  await expect(build).toBeEnabled()
  await script.fill('This changed script needs another review.')
  await expect(build).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: /approve public publication/ })).not.toBeChecked()
})
