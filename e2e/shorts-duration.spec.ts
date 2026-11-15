import { test, expect } from '@playwright/test'
import { gotoAuthed } from './helpers'

test('Short script generator uses channel duration, accepts override and persists it', async ({ page }) => {
  await page.route('**/api/channel-profiles/*', route => route.fulfill({
    json: { ok: true, profile: { shorts_duration_seconds: 90 } },
  }))
  let prompt = ''
  await page.route('**/api/ai/claude', async route => {
    prompt = JSON.stringify(route.request().postDataJSON())
    await route.fulfill({ json: { text: '[0:00-0:03] HOOK\nAn octopus has three hearts.' } })
  })
  await page.addInitScript(() => {
    if (!localStorage.getItem('yt-create-workspace')) {
      localStorage.setItem('yt-create-workspace', JSON.stringify({
        state: { contentType: 'short', channelSlug: 'duration-channel',
          selectedTopic: { topic: 'Why octopuses have three hearts' }, shortsDurationSeconds: null },
        version: 0,
      }))
    }
  })
  await gotoAuthed(page, '/app/create/script')
  const select = page.getByLabel('Shorts length', { exact: true })
  await expect(select.getByRole('option', { name: 'Channel default (90s)' })).toBeAttached()
  await select.selectOption('120')
  await page.getByRole('button', { name: /Generate script/i }).click()
  await expect.poll(() => prompt).toContain('120-second')
  expect(prompt).toContain('238-322')
  expect(prompt).not.toContain('70-100')
  await page.reload()
  await expect(select).toHaveValue('120')
})

test('Script Short forwards override instead of the channel default', async ({ page }) => {
  await page.route('**/api/channel-profiles/*', route => route.fulfill({
    json: { ok: true, profile: { shorts_duration_seconds: 150 } },
  }))
  await page.route('**/api/shorts/script/status', route => route.fulfill({ json: { status: 'idle' } }))
  let duration: number | undefined
  await page.route('**/api/shorts/script/run', async route => {
    duration = route.request().postDataJSON().duration_seconds
    await route.fulfill({ json: { ok: true } })
  })
  await gotoAuthed(page, '/app/shorts')
  await page.getByRole('button', { name: /Script Short.*Voice narration/ }).click()
  const select = page.getByLabel('Shorts length', { exact: true })
  await expect(select.getByRole('option', { name: 'Channel default (150s)' })).toBeAttached()
  await select.selectOption('60')
  await page.getByPlaceholder('e.g. 3 Facts About the Ocean').fill('Octopus hearts')
  await page.getByPlaceholder('Hook: One specific, truthful surprise.', { exact: false }).fill('Two hearts supply the gills; one supplies the body.')
  await page.getByRole('button', { name: 'Build & Upload private Short' }).click()
  await expect.poll(() => duration).toBe(60)
})

test('channel Shorts default is saved and restored on reload', async ({ page }) => {
  let savedDuration = 120
  await page.route('**/api/channel-profiles/duration-channel', async route => {
    if (route.request().method() === 'POST') {
      savedDuration = route.request().postDataJSON().shorts_duration_seconds
    }
    await route.fulfill({ json: { ok: true, profile: { shorts_duration_seconds: savedDuration } } })
  })
  await gotoAuthed(page, '/app/channels/duration-channel/setup')
  const input = page.getByLabel('Default Shorts length', { exact: true })
  await expect(input).toHaveValue('120')
  await input.fill('181')
  await expect(page.getByRole('button', { name: 'Save defaults', exact: true })).toBeDisabled()
  await input.fill('90')
  await page.getByRole('button', { name: 'Save defaults', exact: true }).click()
  await expect.poll(() => savedDuration).toBe(90)
  await page.reload()
  await expect(input).toHaveValue('90')
})
