/**
 * Consent for non-essential device storage.
 *
 * ePrivacy Article 5(3) requires consent before storing information on, or
 * reading information from, a user's device — unless the storage is strictly
 * necessary to provide a service the user explicitly requested.
 *
 * In this app almost everything is in the "strictly necessary" category:
 *
 *   vidora_access_token / vidora_refresh_token / vidora_user
 *       Keeping the user signed in. Strictly necessary.
 *   yt-create-workspace, vidora_bookmarks_*, vidora_checklist_dismissed_*
 *       Remembering the user's own drafts and dismissals. These exist only to
 *       provide a feature the user asked for, so also strictly necessary.
 *   vidora_consent
 *       This record itself — strictly necessary, and it is how we know.
 *
 * The single non-essential purpose is Sentry Session Replay, which records the
 * screen for error diagnostics. It stays OFF until the user opts in, and it is
 * the only reason the consent banner exists. Everything else works identically
 * whether the user accepts or refuses.
 */

export type ConsentState = 'granted' | 'denied' | 'unset'

/** Bump when what we ask for changes, so stale consents are re-collected. */
const VERSION = 1
const KEY = 'vidora_consent'

/** Fired on window whenever the decision changes, so listeners can react. */
export const CONSENT_EVENT = 'vidora:consent'

export interface ConsentRecord {
  version: number
  replay: 'granted' | 'denied'
  decidedAt: string
}

export function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConsentRecord
    // A version mismatch means we are asking for something different now, so
    // the old answer does not carry over — ask again.
    if (parsed?.version !== VERSION) return null
    if (parsed.replay !== 'granted' && parsed.replay !== 'denied') return null
    return parsed
  } catch {
    // Unreadable or storage disabled (private mode). Treat as no decision.
    return null
  }
}

/** Consent state for the replay purpose: 'granted' | 'denied' | 'unset'. */
export function replayConsent(): ConsentState {
  return readConsent()?.replay ?? 'unset'
}

export function saveConsent(replay: 'granted' | 'denied'): void {
  const record: ConsentRecord = {
    version: VERSION,
    replay,
    decidedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    // Storage unavailable. The decision still applies for this page view, and
    // we will simply ask again next time — fail closed, never assume granted.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT))
}

/** Forget the decision so the banner is shown again (used by the Cookie Policy page). */
export function clearConsent(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
  window.dispatchEvent(new Event(CONSENT_EVENT))
}
