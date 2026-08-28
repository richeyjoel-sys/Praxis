// The nine hotels on a map. Markers separate when they would collide; a
// dashed leader points at the true spot. Terracotta = confirmed position,
// sage = approximate.

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Hotel, HotelGeo } from '@/model/types'
import { n } from '@/lib/format'

interface Pin {
  m: L.Marker
  home: L.LatLng
  r: number
}

const R = 15

function declutter(map: L.Map, pins: Pin[], leaders: { current: L.LayerGroup | null }) {
  if (!pins.length) return
  const sz = map.getSize()
  if (!sz || sz.x < 80 || sz.y < 80) return
  const z = map.getZoom()
  if (z == null) return
  const p = pins.map((x) => ({ ...x, pt: map.project(x.home, z).clone() }))
  for (let pass = 0; pass < 220; pass++) {
    let moved = false
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) {
        const a = p[i]!
        const b = p[j]!
        let dx = b.pt.x - a.pt.x
        let dy = b.pt.y - a.pt.y
        // square icons only clear on the diagonal at 2r·√2, not 2r
        const min = (a.r + b.r) * 1.45 + 3
        let d = Math.hypot(dx, dy)
        if (d >= min) continue
        if (d < 0.01) {
          dx = 0.6
          dy = -0.8
          d = 1
        }
        const push = (min - d) / 2
        const ux = dx / d
        const uy = dy / d
        a.pt.x -= ux * push
        a.pt.y -= uy * push
        b.pt.x += ux * push
        b.pt.y += uy * push
        moved = true
      }
    if (!moved) break
  }
  // build the whole set first, then swap — a throw mid-build can never leave an empty group
  const next = L.layerGroup()
  p.forEach((x, i) => {
    const to = map.unproject(x.pt, z)
    pins[i]!.m.setLatLng(to)
    // always mark the true position — a marker that moved silently is worse than one that overlaps
    next.addLayer(
      L.polyline([x.home, to], { color: '#201e1d', weight: 1.25, opacity: 0.38, dashArray: '2 3', interactive: false }),
    )
    next.addLayer(L.circleMarker(x.home, { radius: 2.5, weight: 0, fillColor: '#201e1d', fillOpacity: 0.55, interactive: false }))
  })
  const old = leaders.current
  next.addTo(map)
  leaders.current = next
  if (old) map.removeLayer(old)
}

export function HomeMap({
  hotels,
  geo,
  onPick,
}: {
  hotels: Hotel[]
  geo: Record<string, HotelGeo>
  onPick: (name: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const map = L.map(el, { zoomControl: false, center: [32.727, -117.168], zoom: 13 })
    L.control.zoom({ position: 'bottomleft' }).addTo(map)
    // OpenStreetMap's own tiles — no API key, same source the planner's
    // "Pull the real map" uses. (CARTO's basemaps began requiring a key.)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    const leaders = { current: L.layerGroup().addTo(map) as L.LayerGroup | null }
    const pins: Pin[] = []
    const pts: L.LatLngTuple[] = []
    hotels.forEach((h) => {
      const g = geo[h.name]
      if (!g) return
      pts.push([g.lat, g.lon])
      const mk = L.marker([g.lat, g.lon], {
        riseOnHover: true,
        icon: L.divIcon({
          className: '',
          html: `<div class="hcount" style="width:${R * 2}px;height:${R * 2}px;font-size:11px;background:${g.exact ? '#c67139' : '#7a8a5e'}">${h.code}</div>`,
          iconSize: [R * 2, R * 2],
          iconAnchor: [R, R],
        }),
      }).addTo(map)
      mk.bindTooltip(
        `<b>${h.short}</b><br/>${n(h.delegates)} delegates` + (g.exact ? '' : '<br/><i>position approximate</i>'),
        { direction: 'top', offset: [0, -R] },
      )
      mk.on('click', () => onPickRef.current(h.name))
      pins.push({ m: mk, home: L.latLng(g.lat, g.lon), r: R })
    })
    const fit = () => {
      try {
        const sz = map.getSize()
        if (!pts.length || sz.x < 80 || sz.y < 80) return
        const pad = Math.max(28, Math.min(56, Math.round(sz.x * 0.06)))
        map.fitBounds(pts, { padding: L.point(pad, 36), animate: false })
      } catch {
        /* container not laid out yet */
      }
    }
    // transient projection state during zoom/pan animation can throw inside Leaflet — never let it escape
    const relax = () => {
      try {
        declutter(map, pins, leaders)
      } catch (e) {
        console.warn('declutter deferred', e instanceof Error ? e.message : e)
      }
    }
    map.on('zoomend', relax)
    map.on('moveend', relax)
    map.on('resize', () => {
      fit()
      relax()
    })
    map.whenReady(() => {
      map.invalidateSize()
      fit()
      relax()
    })
    const t1 = setTimeout(() => {
      map.invalidateSize()
      fit()
      relax()
    }, 120)
    const t2 = setTimeout(relax, 500)
    const t3 = setTimeout(relax, 1000)
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      ro.disconnect()
      map.remove()
    }
  }, [hotels, geo])

  return <div ref={ref} style={{ minWidth: 0, minHeight: 0, height: '100%' }} />
}
