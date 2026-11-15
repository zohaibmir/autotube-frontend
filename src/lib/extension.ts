/**
 * Talking to the Vidora browser extension from the dashboard.
 *
 * `chrome.runtime.sendMessage` is only injected into a page when the extension declares
 * `externally_connectable` for that origin — which `extension/manifest.json` does for our own hosts.
 * That is what lets the dashboard hand a token straight over, instead of asking a paying customer to
 * copy a `vdx_…` string between two UIs.
 *
 * Three things this module is deliberate about:
 *
 *  - **The extension id is a constant.** There is no way to ask Chrome "is my extension installed?"
 *    from a web page; the id has to be known in advance. It is fixed once published, and
 *    `VITE_EXTENSION_ID` overrides it for a local build, where the id is derived from the unpacked
 *    path and differs per machine.
 *  - **Absence is normal, not an error.** Most visitors do not have the extension, so every helper
 *    returns a value rather than throwing, and callers show an "install" path instead of a failure.
 *  - **Everything has a timeout.** If the extension is not installed, the callback may simply never
 *    fire — and a button that hangs forever is worse than one that says "not installed".
 */

// Placeholder until the extension is published: the real id is assigned at that point and cannot be
// known before. Set VITE_EXTENSION_ID in .env for a local build.
const EXTENSION_ID: string =
  (import.meta.env?.VITE_EXTENSION_ID as string | undefined) || 'VIDORA_EXTENSION_ID_UNSET';

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage?: (
          extensionId: string,
          message: unknown,
          callback?: (response: unknown) => void,
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
}

/** True when Chrome has injected its messaging API into this page at all. */
export function extensionMessagingAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.chrome?.runtime?.sendMessage;
}

/** True when we have a real id to send to, rather than the placeholder. */
export function extensionIdConfigured(): boolean {
  return EXTENSION_ID !== 'VIDORA_EXTENSION_ID_UNSET';
}

function send(message: unknown, timeoutMs = 1500): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    if (!extensionMessagingAvailable() || !extensionIdConfigured()) {
      resolve({ ok: false, error: 'not-available' });
      return;
    }
    let settled = false;
    const done = (value: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => done({ ok: false, error: 'timeout' }), timeoutMs);

    try {
      window.chrome!.runtime!.sendMessage!(EXTENSION_ID, message, (response) => {
        clearTimeout(timer);
        // `lastError` is set when nothing answered — an uninstalled extension, most often. That is a
        // normal outcome here, not an exception.
        if (window.chrome?.runtime?.lastError) {
          done({ ok: false, error: 'not-installed' });
          return;
        }
        done((response as Record<string, unknown>) || { ok: false, error: 'empty' });
      });
    } catch (e) {
      clearTimeout(timer);
      done({ ok: false, error: 'exception' });
    }
  });
}

/** Is the extension installed and listening? Resolves false rather than throwing. */
export async function pingExtension(): Promise<boolean> {
  const res = await send({ type: 'extension-ping' });
  return res.ok === true;
}

/** Hand the extension a token so the user never has to copy one. */
export async function linkExtension(token: string): Promise<{ ok: boolean; error?: string }> {
  const res = await send({ type: 'link-account', token });
  if (res.ok === true) return { ok: true };
  const error = typeof res.error === 'string' ? res.error : 'unknown';
  return { ok: false, error };
}

/**
 * A message a human can act on, per failure.
 *
 * Deliberately not one generic string: "install the extension" and "the extension did not answer in
 * time" are different things for the user to do, and telling them apart costs nothing here.
 */
export function linkFailureMessage(error?: string): string {
  switch (error) {
    case 'not-available':
    case 'not-installed':
      return 'The Vidora extension is not installed in this browser. Install it, then try again.';
    case 'timeout':
      return 'The extension did not answer. Reload it from chrome://extensions and try again.';
    default:
      return 'Could not link the extension. You can still copy the token below and paste it into the extension yourself.';
  }
}
