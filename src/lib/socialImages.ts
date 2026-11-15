export function socialImagePath(path = '/'): string {
  return `/social/${path === '/' ? 'home' : path.slice(1).replace(/\//g, '-')}.png`
}
