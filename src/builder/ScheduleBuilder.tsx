// Schedule builder — the shifts and movements. Where every planning decision
// is made. Three shift cards side by side, and the "still proposed" note.

import { SHIFTS } from '@/model/library'
import { Micro } from '@/ui'
import { ShiftCard } from './ShiftCard'
import s from './builder.module.css'

export function ScheduleBuilder() {
  return (
    <div className={s.pane}>
      <div className={s.grid}>
        {SHIFTS.map((sh) => (
          <ShiftCard key={sh.id} sh={sh} />
        ))}
      </div>
      <div className={s.proposed}>
        <Micro accent>Still proposed</Micro>
        <div className={s.proposedText}>
          Role counts start from proposed ratios — 1 Pick-Up per 50 on a coach, 1 Greeter per 150 moving, two on the
          desk — and the ± buttons adjust from there. Coaches assume 48 seats; private vehicles start at zero for you to
          set. Give me your real ratios and seat count and the starting numbers change.
        </div>
      </div>
    </div>
  )
}
