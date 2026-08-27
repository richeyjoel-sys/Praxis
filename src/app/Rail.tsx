// Left rail: the mark, one button per hotel (right-click for its card),
// add a hotel, the setup studio, and back to the map.

import { useModel } from '@/model/useModel'
import * as A from '@/state/actions'
import { label } from '@/lib/shortcuts'
import { n } from '@/lib/format'
import s from './Rail.module.css'

export function Rail() {
  const m = useModel()
  const cur = m.ui.hotel
  return (
    <nav className={s.rail} aria-label="Hotels">
      <button className={s.mark} onClick={A.goHome} title="All hotels">
        Px
      </button>
      <div className={s.rule} />
      <div className={s.hotels}>
        {m.hotels().map((h) => (
          <button
            key={h.name}
            className={s.hotel}
            aria-current={cur === h.name}
            title={`${h.short} — ${n(h.delegates)} delegates · right-click for details`}
            onClick={() => A.goHotel(h.name)}
            onContextMenu={(e) => {
              e.preventDefault()
              A.openHotelCard(h.name, e.currentTarget.getBoundingClientRect().top)
            }}
          >
            {h.code}
          </button>
        ))}
      </div>
      <button className={s.round} onClick={A.addHotel} title="Add a hotel">
        ＋
      </button>
      <button
        className={s.studio}
        aria-pressed={m.ui.studio}
        onClick={() => (m.ui.studio ? A.closeStudio() : A.openStudio())}
        title={`Setup studio — global activities · ${label({ key: ',', meta: true })}`}
      >
        ⚙
      </button>
      <button className={s.map} aria-current={cur === null} onClick={A.goHome} title="All nine hotels">
        ◎
      </button>
    </nav>
  )
}
