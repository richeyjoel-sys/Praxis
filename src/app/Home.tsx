// Home: the standing figures, the day picker, the hotel list, and the map.

import { useModel } from '@/model/useModel'
import { GEO } from '@/data/geo'
import * as A from '@/state/actions'
import { Micro, Pill } from '@/ui'
import { dayLabel, n } from '@/lib/format'
import { HomeMap } from './HomeMap'
import s from './Home.module.css'

export function Home() {
  const m = useModel()
  const iso = m.iso()
  const hotels = m.hotels()
  const tot = hotels.reduce((t, x) => t + x.delegates, 0)
  const approx = hotels.filter((x) => GEO[x.name] && !GEO[x.name]!.exact).length

  return (
    <div className={s.grid}>
      <div className={s.side}>
        <div className={s.card}>
          <Micro>San Diego · IC 2026</Micro>
          <h1 className={s.h1}>
            Nine hotels,
            <br />
            ten days.
          </h1>
          <p className={s.standing}>
            {n(tot)} delegates across the pickup hotels. Pick one to work its plan and its three shifts for{' '}
            {dayLabel(iso, 'long')}.
          </p>
          <div className={s.days}>
            {m.dateList().map((d) => (
              <Pill key={d} small on={d === iso} onClick={() => A.setDate(d)}>
                {dayLabel(d, 'pill')}
              </Pill>
            ))}
          </div>
        </div>
        <div className={s.list}>
          {hotels.map((x) => {
            const acts = m.day(x.name, iso).acts
            const g = GEO[x.name]
            const approxPos = g && !g.exact
            return (
              <button key={x.name} className={s.hotelRow} onClick={() => A.goHotel(x.name)}>
                <span className={s.badge} data-approx={approxPos ? 'true' : undefined}>
                  {x.code}
                </span>
                <span className={s.hotelText}>
                  <span className={s.hotelName}>{x.short}</span>
                  <span className={s.hotelMeta}>
                    {n(x.delegates)} delegates · {acts.filter((a) => a.m === 'Bus').length} on coaches
                    {approxPos ? ' · approximate' : ''}
                  </span>
                </span>
                <span className={s.hotelNum} data-zero={acts.length === 0 ? 'true' : undefined}>
                  {acts.length}
                </span>
              </button>
            )
          })}
        </div>
        <div className={s.legend}>
          <Micro>Reading the map</Micro>
          <div className={s.legendText}>
            Terracotta is a confirmed position, sage an approximate one — {approx} addresses still to confirm.
            Markers separate when they would collide; the dashed leader points at the true spot.
          </div>
        </div>
      </div>
      <HomeMap hotels={hotels} geo={GEO} onPick={A.goHotel} />
    </div>
  )
}
