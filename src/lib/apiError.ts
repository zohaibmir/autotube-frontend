/**
 * Turn an API error into a message safe to hand to a toast.
 *
 * FastAPI's `detail` is a plain string for most errors, but the billing gates
 * return a **structured object**:
 *
 *   { detail: { code: 'channel_limit_reached', used: 1, limit: 1,
 *               message: 'Your plan allows 1 connected channel. ...' } }
 *
 * Passing that object to `addToast(message: string)` (or into `setState` for an
 * error banner) means React gets an object as a child and throws
 * "Objects are not valid as a React child" -- the toast stack crashes instead of
 * showing the message the backend went to the trouble of writing.
 *
 * `channel_limit_reached` was reachable by any free account adding a second
 * channel the moment `_enforce_channel_limit` started gating it, and the call site
 * passed `detail` straight through.
 *
 * Prefer the backend's own `message`: it knows the limit and the plan.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail

  if (typeof detail === 'string' && detail.trim()) return detail

  if (detail && typeof detail === 'object') {
    const message = (detail as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }

  const generic = (err as { message?: unknown })?.message
  if (typeof generic === 'string' && generic.trim()) return generic

  return fallback
}
