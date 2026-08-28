// App shell: the rail on the left, the home map or one hotel filling the rest.
//
// Layout invariant (the prototype's dominant defect class was a fixed-height
// or sticky element squeezing the canvas): the shell fills the viewport
// exactly; the hotel body is the ONE scroller; nothing in the chrome is
// sticky. See docs/ARCHITECTURE.md → "Layout invariant".

import { useEffect, useMemo } from 'react'
import { useShortcuts } from '@/lib/shortcuts'
import { useStore } from '@/state/store'
import { useModel } from '@/model/useModel'
import { applyTheme } from '@/lib/theme'
import * as A from '@/state/actions'
import { Rail } from './Rail'
import { Home } from './Home'
import { HotelScreen } from './HotelScreen'
import { Studio } from '@/studio/Studio'
import { HotelCard } from '@/studio/HotelCard'
import s from './App.module.css'

export function App() {
  const m = useModel()
  const undo = useStore((st) => st.undo)
  const redo = useStore((st) => st.redo)
  const atHotel = m.hotel() !== null
  const studio = m.ui.studio
  const hotelCard = m.ui.hotelCard
  const theme = m.doc.ev.theme

  useEffect(() => {
    applyTheme(theme?.a || null, theme?.b)
  }, [theme?.a, theme?.b])

  // the clock: play advances simulated minutes at ×speed real time
  const playing = m.ui.playing
  const speed = m.ui.speed
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let acc = useStore.getState().ui.mins
    let raf = 0
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop)
      const dt = (ts - last) / 1000
      last = ts
      acc += (dt * speed) / 60
      if (acc > 1350) acc = 360
      const cur = useStore.getState().ui.mins
      if (Math.abs(acc - cur) >= 1) A.setMins(Math.floor(acc))
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])

  const bindings = useMemo(
    () => [
      { combo: { key: 'z', meta: true }, run: undo, inFields: true },
      { combo: { key: 'z', meta: true, shift: true }, run: redo, inFields: true },
      { combo: { key: '1', meta: true }, run: () => A.setView('builder') },
      { combo: { key: '2', meta: true }, run: () => A.setView('planner') },
      { combo: { key: '3', meta: true }, run: () => A.setView('report') },
      { combo: { key: ',', meta: true }, run: () => (useStore.getState().ui.studio ? A.closeStudio() : A.openStudio()) },
      {
        combo: { key: 'Escape' },
        run: () => {
          const u = useStore.getState().ui
          if (u.studio) return A.closeStudio()
          if (u.hotelCard) return A.closeHotelCard()
          if (u.setup) return A.closeSetup()
          if (u.view === 'planner') {
            A.armTool(null)
            A.setDraftTool('select')
            A.select(null)
          }
        },
      },
      {
        combo: { key: 'Backspace' },
        run: () => {
          const u = useStore.getState().ui
          if (u.view === 'planner' && (u.sel || u.msel?.length)) A.deleteSelection(m)
        },
      },
      {
        combo: { key: 'Delete' },
        run: () => {
          const u = useStore.getState().ui
          if (u.view === 'planner' && (u.sel || u.msel?.length)) A.deleteSelection(m)
        },
      },
    ],
    [undo, redo, m],
  )
  useShortcuts(bindings)

  return (
    <div className={s.shell}>
      {studio && <Studio />}
      {hotelCard && <HotelCard />}
      <Rail />
      <div className={s.main}>{atHotel ? <HotelScreen /> : <Home />}</div>
    </div>
  )
}
