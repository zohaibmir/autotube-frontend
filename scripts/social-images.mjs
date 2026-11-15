import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#FAFBFC"/>
  <rect x="0" y="0" width="16" height="630" fill="#1A3A52"/>
  <rect x="88" y="78" width="56" height="56" rx="16" fill="#1A3A52"/>
  <path d="M108 92 L132 106 L108 120 Z" fill="white"/>
  <path d="M88 500 H1112" stroke="#D4DDE3" stroke-width="2"/>
</svg>`)

export async function generateBrandImages() {
  const svg = await readFile('public/favicon.svg')
  await sharp(svg).resize(48, 48).png().toFile('dist/favicon.png')
  await sharp(svg).resize(192, 192).png().toFile('dist/brand-logo.png')
  await mkdir('dist/font-licenses', { recursive: true })
  for (const font of ['inter', 'lora']) {
    await cp(`node_modules/@fontsource-variable/${font}/LICENSE`, `dist/font-licenses/${font}.txt`)
  }
}

export async function generateSocialImage(file, htmlTitle) {
  const title = htmlTitle.replace(/ \| Vidora$/, '')
  const headline = await sharp({
    text: { text: `<span foreground="#1A3A52">${title}</span>`, font: 'sans bold 54', width: 1024, rgba: true },
  }).png().toBuffer({ resolveWithObject: true })
  if (headline.info.width > 1024 || headline.info.height > 280) throw new Error(`Social headline exceeds its card: ${title}`)
  const brand = await sharp({ text: { text: '<span foreground="#1A3A52">Vidora</span>', font: 'sans bold 36', rgba: true } }).png().toBuffer()
  const caption = await sharp({
    text: { text: '<span foreground="#525252">AI video production &amp; YouTube workflows</span>', font: 'sans 24', rgba: true },
  }).png().toBuffer()
  const image = await sharp(background).composite([
    { input: brand, left: 162, top: 88 },
    { input: headline.data, left: 88, top: 194 },
    { input: caption, left: 88, top: 540 },
  ]).png({ compressionLevel: 9 }).toBuffer()
  if (image.length > 120_000) throw new Error(`Social card exceeds 120 KB: ${file}`)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, image)
  return { file, bytes: image.length, headlineHeight: headline.info.height }
}
