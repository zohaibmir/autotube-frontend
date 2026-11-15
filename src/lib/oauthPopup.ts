// ── OAuth popup helper ────────────────────────────────────────────────────────
// The backend's OAuth callback page posts { type: 'yt_channel_added', ok } back to
// window.opener and closes itself - wait for that message (or the popup being
// closed manually) before resolving.
//
// Shared by the channel list and the channel detail page: both offer "connect" and
// "reconnect", and two copies of this handshake would drift (the message type and
// the fallback are the parts that matter and the parts easiest to get subtly wrong).
export function openOAuthPopup(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const popup = window.open(url, 'yt-oauth', 'width=520,height=640')
    if (!popup) { resolve(false); return }

    let settled = false
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'yt_channel_added') return
      settled = true
      window.removeEventListener('message', onMessage)
      clearInterval(poll)
      resolve(Boolean(event.data.ok))
    }
    window.addEventListener('message', onMessage)

    // Fallback: if the user closes the popup without completing OAuth
    const poll = window.setInterval(() => {
      if (popup.closed && !settled) {
        clearInterval(poll)
        window.removeEventListener('message', onMessage)
        resolve(false)
      }
    }, 500)
  })
}
