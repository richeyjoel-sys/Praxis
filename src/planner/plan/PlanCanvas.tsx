// PlanCanvas — mounts the imperative PlanSurface on a host div and hands the
// app a small handle (zoom / fit / opacity / clear) for its toolbar.
import { useEffect, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import type { Scene } from '@/model/types'
import { PlanSurface } from './PlanSurface'

export type PlanCanvasHandle = Pick<PlanSurface, 'zoomBy' | 'fitNow' | 'cycleOpacity' | 'clearTool'>

export function PlanCanvas({
  getScene,
  ref,
}: {
  getScene: () => Scene | null
  ref?: Ref<PlanCanvasHandle>
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const surfRef = useRef<PlanSurface | null>(null)
  // the surface polls the scene; always route it to the latest getter
  const getRef = useRef(getScene)
  useEffect(() => {
    getRef.current = getScene
  }, [getScene])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const surf = new PlanSurface(host, () => getRef.current())
    surfRef.current = surf
    return () => {
      surf.destroy()
      if (surfRef.current === surf) surfRef.current = null
    }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (k: number) => surfRef.current?.zoomBy(k),
      fitNow: () => surfRef.current?.fitNow(),
      cycleOpacity: () => surfRef.current?.cycleOpacity(),
      clearTool: () => surfRef.current?.clearTool(),
    }),
    [],
  )

  return <div ref={hostRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }} />
}
