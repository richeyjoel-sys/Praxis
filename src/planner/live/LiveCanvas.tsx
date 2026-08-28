// The Go live surface: a host div the three.js model mounts into.
// Constructed in the effect and destroyed in its cleanup, so a StrictMode
// remount simply creates a fresh instance.
import { useEffect, useRef } from 'react'
import type { SceneV2 } from '@/model/types'
import { LiveModel } from './LiveModel'

export function LiveCanvas({ getScene }: { getScene: () => SceneV2 | null }) {
  const ref = useRef<HTMLDivElement>(null)
  // the model reads the scene every frame; keep the latest getter without remounting it
  const sceneRef = useRef(getScene)
  useEffect(() => {
    sceneRef.current = getScene
  }, [getScene])

  useEffect(() => {
    const host = ref.current
    if (!host) return
    const model = new LiveModel(host, () => sceneRef.current())
    return () => model.destroy()
  }, [])

  return <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }} />
}
