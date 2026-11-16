/**
 * How to get each provider's API key (PRICING_STRATEGY.md §6.4).
 *
 * Shared by Settings → API Keys and the public /guides/api-keys page so the two
 * never disagree. Cost per video is NOT here: it comes from
 * GET /api/public/api-key-costs, which computes it from core/pricing.py.
 */

export type KeyStage = 'script' | 'voice' | 'visuals' | 'animation' | 'music'

export interface ApiKeyGuide {
  id: string
  name: string
  /** What the pipeline uses this key for. */
  description: string
  stage: KeyStage
  consoleUrl: string
  placeholder: string
  steps: string[]
  caveats: string[]
}

export const API_KEY_GUIDES: ApiKeyGuide[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Script writing, SEO and AI insights',
    stage: 'script',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-api03-...',
    steps: [
      'Sign up or log in at console.anthropic.com.',
      'Open Settings → Billing and add credit. Calls fail until the account has a balance.',
      'Open Settings → API Keys and click Create Key.',
      'Copy the key (it starts with sk-ant-) and paste it into Settings → API Keys.',
    ],
    caveats: ['New accounts start on a low rate-limit tier that rises as you spend.'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Script writing (GPT models) and AI images',
    stage: 'script',
    consoleUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
    steps: [
      'Sign up or log in at platform.openai.com. This is separate from a ChatGPT subscription.',
      'Open Settings → Billing and add prepaid credit.',
      'Open API keys and click Create new secret key.',
      'Copy the key (it starts with sk-) and paste it into Settings → API Keys.',
    ],
    caveats: ['A ChatGPT Plus plan does not include API usage; the API is billed separately.'],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Script writing (Gemini models)',
    stage: 'script',
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIza...',
    steps: [
      'Sign in at aistudio.google.com with a Google account.',
      'Click Get API key, then Create API key, and pick or create a Google Cloud project.',
      'Turn on billing for that project to leave the free tier limits.',
      'Copy the key (it starts with AIza) and paste it into Settings → API Keys.',
    ],
    caveats: ['On the free tier Google may use your prompts to improve its products; paid tier does not.'],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Premium voice narration and background music',
    stage: 'voice',
    consoleUrl: 'https://elevenlabs.io/app/settings/api-keys',
    placeholder: 'sk_...',
    steps: [
      'Sign up or log in at elevenlabs.io.',
      'Pick a paid plan if you publish monetised videos (see the note below).',
      'Open Settings → API Keys and click Create API key. Allow text-to-speech, models and music.',
      'Copy the key and paste it into Settings → API Keys.',
    ],
    caveats: [
      'The free plan does not allow commercial use and requires attribution. Use a paid plan for monetised channels.',
      'Usage is drawn from your plan’s monthly character quota.',
    ],
  },
  {
    id: 'kling',
    name: 'Kling AI',
    description: 'Animated video clips',
    stage: 'animation',
    consoleUrl: 'https://kling.ai/dev',
    placeholder: 'Your Kling API key',
    steps: [
      'Open the Kling developer platform at kling.ai/dev and sign in.',
      'Buy a prepaid API resource pack. API calls are billed from these packs, not from a Kling app subscription.',
      'Open API Keys and create a key.',
      'Paste the single API key into Settings → API Keys. The older Access Key + Secret Key pair is not needed.',
    ],
    caveats: ['Resource packs expire; check the expiry date in the Kling console before a big batch.'],
  },
  {
    id: 'minimax',
    name: 'MiniMax (Hailuo)',
    description: 'Animated video clips (alternative to Kling)',
    stage: 'animation',
    consoleUrl: 'https://platform.minimax.io/user-center/basic-information/interface-key',
    placeholder: 'Your MiniMax API key',
    steps: [
      'Sign up or log in at platform.minimax.io (the international platform).',
      'Open Billing → Balance and top up.',
      'Open API Keys and click Create new secret key.',
      'Copy the key and paste it into Settings → API Keys.',
    ],
    caveats: ['Keys from the China platform (minimaxi.com) do not work with the international API we call.'],
  },
  {
    id: 'pexels',
    name: 'Pexels',
    description: 'Stock footage and images',
    stage: 'visuals',
    consoleUrl: 'https://www.pexels.com/api/',
    placeholder: 'Your Pexels API key',
    steps: [
      'Create a free Pexels account.',
      'Open pexels.com/api and request an API key (describe your project briefly).',
      'Copy the key and paste it into Settings → API Keys.',
    ],
    caveats: ['Pexels is free. We provide it on every plan, so your own key is optional.'],
  },
  {
    id: 'replicate',
    name: 'Replicate',
    description: 'AI image generation (Flux / SDXL)',
    stage: 'visuals',
    consoleUrl: 'https://replicate.com/account/api-tokens',
    placeholder: 'r8_...',
    steps: [
      'Sign in at replicate.com.',
      'Add a payment method under Account → Billing.',
      'Open Account → API tokens and create a token.',
      'Copy the token (it starts with r8_) and paste it into Settings → API Keys.',
    ],
    caveats: [],
  },
  {
    id: 'suno',
    name: 'Suno (via sunoapi.org)',
    description: 'AI music, optional fallback',
    stage: 'music',
    consoleUrl: 'https://sunoapi.org',
    placeholder: 'Your sunoapi.org key',
    steps: [
      'Suno itself has no public API. This key is for the third-party sunoapi.org service.',
      'Create an account at sunoapi.org and buy credits there.',
      'Copy the API key from its dashboard and paste it into Settings → API Keys.',
    ],
    caveats: [
      'Music runs on ElevenLabs by default; you only need this if you prefer Suno.',
      'sunoapi.org is not affiliated with Suno. Check its terms before commercial use.',
    ],
  },
  {
    id: 'mureka',
    name: 'Mureka',
    description: 'AI music, optional fallback',
    stage: 'music',
    consoleUrl: 'https://mureka.ai/dashboard',
    placeholder: 'Your Mureka API key',
    steps: [
      'Sign in at mureka.ai and open the API section of your dashboard.',
      'Buy API credit, then create a key.',
      'Copy the key and paste it into Settings → API Keys.',
    ],
    caveats: ['Music runs on ElevenLabs by default; you only need this if you prefer Mureka.'],
  },
]

/** Which provider keys cover each stage of a render. Pexels is lent free on every plan. */
export const STAGE_PROVIDERS: Record<KeyStage, string[]> = {
  script: ['anthropic', 'openai', 'gemini'],
  voice: ['elevenlabs'],
  visuals: ['pexels', 'openai', 'replicate'],
  animation: ['kling', 'minimax'],
  music: ['elevenlabs', 'suno', 'mureka'],
}

export const STAGE_LABELS: Record<KeyStage, string> = {
  script: 'script',
  voice: 'premium voice',
  visuals: 'AI images',
  animation: 'animation clips',
  music: 'music',
}

export interface ProviderCost {
  usd: number | null
  basis: string
  estimated?: boolean
}

export function formatProviderCost(cost: ProviderCost | undefined): string | null {
  if (!cost) return null
  if (cost.usd == null) return `Cost: ${cost.basis}`
  if (cost.usd === 0) return `Free: ${cost.basis}`
  const usd = cost.usd < 0.1 ? cost.usd.toFixed(3) : cost.usd.toFixed(2)
  return `≈ $${usd} for ${cost.basis}${cost.estimated ? ', estimated' : ''}`
}

/**
 * "What you still pay us for": the stages a render would still run on our keys,
 * given which keys are connected. Pexels and Edge TTS are free, so stock visuals and
 * the standard voice never appear here.
 */
export function hostedStages(connected: Record<string, boolean>): KeyStage[] {
  const owned = (stage: KeyStage) => STAGE_PROVIDERS[stage].some(p => connected[p])
  return (['script', 'voice', 'music', 'animation'] as KeyStage[]).filter(s => !owned(s))
}
