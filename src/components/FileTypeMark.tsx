const TONES: Record<string, { label: string; tone: string }> = {
  ts: { label: 'TS', tone: 'code' },
  tsx: { label: 'TS', tone: 'code' },
  js: { label: 'JS', tone: 'code' },
  jsx: { label: 'JS', tone: 'code' },
  mjs: { label: 'JS', tone: 'code' },
  md: { label: 'MD', tone: 'doc' },
  mdx: { label: 'MD', tone: 'doc' },
  css: { label: 'CSS', tone: 'style' },
  scss: { label: 'CSS', tone: 'style' },
  json: { label: 'JSON', tone: 'data' },
  html: { label: 'HTML', tone: 'doc' },
  svg: { label: 'SVG', tone: 'image' },
  png: { label: 'PNG', tone: 'image' },
  jpg: { label: 'IMG', tone: 'image' },
  jpeg: { label: 'IMG', tone: 'image' },
  webp: { label: 'IMG', tone: 'image' },
  py: { label: 'PY', tone: 'code' },
}

export function fileNameOf(path: string) {
  return path.split('/').pop() ?? path
}

export function FileTypeMark({ path, size = 20 }: { path: string; size?: number }) {
  const ext = (path.split('/').pop() ?? path).includes('.')
    ? (path.split('/').pop() ?? '').split('.').pop()?.toLowerCase() ?? ''
    : ''
  const kind = TONES[ext] ?? { label: (ext || 'FILE').slice(0, 4).toUpperCase(), tone: 'file' }
  return (
    <span className={`aha-file-mark aha-file-mark--${kind.tone}`} style={{ minWidth: size, height: size }} aria-hidden="true">
      {kind.label}
    </span>
  )
}
