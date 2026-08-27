// The accent pair drives a full ramp, so one choice re-tints the whole app.
// Runtime-written to a <style id="praxis-theme"> so every token consumer —
// React, the SVG surface, the 3D model — sees the same colours.

export function ramp(hex: string, role: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const bl = n & 255
  const mix = (t: number, to: number) => {
    const f = (c: number, d: number) => Math.round(c + (d - c) * t)
    return (
      '#' +
      [f(r, to), f(g, to), f(bl, to)]
        .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
        .join('')
    )
  }
  const out = [`--color-${role}: ${hex};`]
  ;([
    [100, 0.88],
    [200, 0.74],
    [300, 0.56],
    [400, 0.28],
  ] as const).forEach(([k, t]) => out.push(`--color-${role}-${k}: ${mix(t, 255)};`))
  out.push(`--color-${role}-500: ${hex};`)
  ;([
    [600, 0.18],
    [700, 0.34],
    [800, 0.5],
    [900, 0.66],
  ] as const).forEach(([k, t]) => out.push(`--color-${role}-${k}: ${mix(t, 26)};`))
  return out.join('')
}

export function applyTheme(a: string | null, b?: string | null) {
  let el = document.getElementById('praxis-theme') as HTMLStyleElement | null
  if (!a) {
    if (el) el.textContent = ''
    return
  }
  if (!el) {
    el = document.createElement('style')
    el.id = 'praxis-theme'
    document.head.appendChild(el)
  }
  el.textContent = ':root{' + ramp(a, 'accent') + ramp(b || a, 'accent-2') + '}'
}

/** The two-to-four colours a logo is actually built from. */
export function logoColours(src: string): Promise<string[]> {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const n = 48
      const cv = document.createElement('canvas')
      cv.width = cv.height = n
      const cx = cv.getContext('2d')
      if (!cx) return res([])
      cx.drawImage(img, 0, 0, n, n)
      const d = cx.getImageData(0, 0, n, n).data
      const bins: Record<number, { n: number; r: number; g: number; b: number }> = {}
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3]! < 160) continue
        const r = d[i]!
        const g = d[i + 1]!
        const b = d[i + 2]!
        const mx = Math.max(r, g, b)
        const mn = Math.min(r, g, b)
        if (mx - mn < 26 || mx < 34 || mn > 232) continue // skip greys and near-white
        const k = ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5)
        const bin = (bins[k] = bins[k] || { n: 0, r: 0, g: 0, b: 0 })
        bin.n++
        bin.r += r
        bin.g += g
        bin.b += b
      }
      const hex = (v: number[]) => '#' + v.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')
      const list = Object.values(bins)
        .sort((x, y) => y.n - x.n)
        .slice(0, 8)
        .map((o) => ({ hex: hex([o.r / o.n, o.g / o.n, o.b / o.n]), n: o.n }))
      // keep colours that differ from each other, so the pair reads as two voices
      const far = (h1: string, h2: string) => {
        const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
        const [a1, b1, c1] = p(h1) as [number, number, number]
        const [a2, b2, c2] = p(h2) as [number, number, number]
        return Math.hypot(a1 - a2, b1 - b2, c1 - c2) > 62
      }
      const keep: { hex: string; n: number }[] = []
      list.forEach((o) => {
        if (keep.every((k) => far(k.hex, o.hex))) keep.push(o)
      })
      res(keep.slice(0, 4).map((o) => o.hex))
    }
    img.onerror = () => res([])
    img.src = src
  })
}
