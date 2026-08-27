// App shell: the rail on the left, one surface filling the rest.
//
// Layout invariant (the prototype's dominant defect class was a fixed-height
// or sticky element squeezing the canvas): the shell is a CSS grid that fills
// the viewport exactly; each surface owns its own scroller; nothing in the
// chrome is sticky. See docs/ARCHITECTURE.md → "Layout invariant".

import { useMemo } from 'react'
import { useShortcuts, label } from '@/lib/shortcuts'
import { useStore } from '@/state/store'
import { Rail } from './Rail'
import { ScheduleBuilder } from '@/builder/ScheduleBuilder'
import { FlowPlanner } from '@/planner/FlowPlanner'
import s from './App.module.css'

export function App() {
  const surface = useStore((st) => st.plan.surface)
  const undo = useStore((st) => st.undo)
  const redo = useStore((st) => st.redo)
  const set = useStore((st) => st.set)

  const bindings = useMemo(
    () => [
      { combo: { key: 'z', meta: true }, run: undo, inFields: true },
      { combo: { key: 'z', meta: true, shift: true }, run: redo, inFields: true },
      { combo: { key: '1', meta: true }, run: () => set((d) => void (d.surface = 'builder')) },
      { combo: { key: '2', meta: true }, run: () => set((d) => void (d.surface = 'planner')) },
    ],
    [undo, redo, set],
  )
  useShortcuts(bindings)

  return (
    <div className={s.shell}>
      <Rail />
      <main className={s.surface} aria-label={surface === 'builder' ? 'Schedule builder' : 'Flow planner'}>
        {surface === 'builder' ? <ScheduleBuilder /> : <FlowPlanner />}
      </main>
      <span className="sr-only">Undo {label({ key: 'z', meta: true })}</span>
    </div>
  )
}
