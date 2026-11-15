import { readConsent } from './lib/consent'

// Inlined before the first paint; keep saved preferences out of the SSR banner.
document.documentElement.toggleAttribute('data-consent-decided', readConsent() !== null)
