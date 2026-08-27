// Left rail: surface switch, undo (with its depth printed), setup studio.
// Icons are drawn inline — the app uses its own drawn icon set, no icon font.

import { label } from '@/lib/shortcuts'
import { useStore } from '@/state/store'
import s from './Rail.module.css'

const Icon = {
  builder: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4v5M16 4v5" />
    </svg>
  ),
  planner: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  ),
  undo: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  ),
  gear: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </svg>
  ),
}

export function Rail() {
  const surface = useStore((st) => st.plan.surface)
  const set = useStore((st) => st.set)
  const undo = useStore((st) => st.undo)
  const depth = useStore((st) => st.history.past.length)

  return (
    <nav className={s.rail} aria-label="Praxis">
      <div className={s.logo} aria-hidden>
        P
      </div>
      <button
        className={s.btn}
        aria-current={surface === 'builder'}
        title={`Schedule builder · ${label({ key: '1', meta: true })}`}
        onClick={() => set((d) => void (d.surface = 'builder'))}
      >
        {Icon.builder}
      </button>
      <button
        className={s.btn}
        aria-current={surface === 'planner'}
        title={`Flow planner · ${label({ key: '2', meta: true })}`}
        onClick={() => set((d) => void (d.surface = 'planner'))}
      >
        {Icon.planner}
      </button>
      <div className={s.spacer} />
      <button
        className={s.btn}
        title={`Undo · ${label({ key: 'z', meta: true })}`}
        onClick={undo}
        disabled={depth === 0}
      >
        {Icon.undo}
        {depth > 0 && <span className={s.count}>{depth}</span>}
      </button>
      <button className={s.btn} title="Setup studio · ," onClick={() => {}}>
        {Icon.gear}
      </button>
    </nav>
  )
}
