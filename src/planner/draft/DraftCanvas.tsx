// DraftCanvas — mounts the imperative DraftSurface on a host div and hands
// the app a small handle (zoom / fit / opacity / clear / map pull).
import { useEffect, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import type { SceneV2 } from '@/model/types'
import { DraftSurface } from './DraftSurface'

export interface DraftCanvasHandle {
  zoomBy: (k: number) => void
  fitNow: () => void
  cycleOpacity: () => void
  clearTool: () => void
  startAlign: () => void
  toggleUnderlay: () => boolean
  pullMap: (lat: number, lon: number) => Promise<boolean>
}

export function DraftCanvas({ getScene, ref }: { getScene: () => SceneV2 | null; ref?: Ref<DraftCanvasHandle> }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const surfRef = useRef<DraftSurface | null>(null)
  const getRef = useRef(getScene)
  useEffect(() => {
    getRef.current = getScene
  }, [getScene])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const surf = new DraftSurface(host, () => getRef.current())
    surfRef.current = surf
    return () => {
      surf.destroy()
      if (surfRef.current === surf) surfRef.current = null
    }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (k) => surfRef.current?.zoomBy(k),
      fitNow: () => surfRef.current?.fitNow(),
      cycleOpacity: () => surfRef.current?.cycleOpacity(),
      clearTool: () => surfRef.current?.clearTool(),
      startAlign: () => surfRef.current?.startAlign(),
      toggleUnderlay: () => surfRef.current?.toggleUnderlay() ?? true,
      pullMap: (lat, lon) => surfRef.current?.pullMap(lat, lon) ?? Promise.resolve(false),
    }),
    [],
  )

  return <div ref={hostRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }} />
}
