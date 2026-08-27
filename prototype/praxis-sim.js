// Praxis simulation engine — pure and deterministic.
// WorldState = at(T): every position is a closed-form function of simulated time,
// so play is smooth, pause is exact, and scrubbing reconstructs rather than reverses.
(function () {
  const WALK = 75;            // metres per simulated minute (1.25 m/s)
  const hash = (s, i) => {    // stable per-person jitter, 0..1
    let h = 2166136261 >>> 0;
    const str = s + '|' + i;
    for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 16777619); }
    return ((h >>> 8) % 1000) / 1000;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (pts) => {
    const L = [0]; let tot = 0;
    for (let i = 1; i < pts.length; i++) {
      tot += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); L.push(tot);
    }
    return {pts, L, total: tot || 0.001};
  };
  const along = (p, f) => {
    const want = Math.max(0, Math.min(1, f)) * p.total;
    for (let i = 1; i < p.pts.length; i++) {
      if (want <= p.L[i]) {
        const t = (want - p.L[i - 1]) / (p.L[i] - p.L[i - 1] || 0.001);
        return {x: lerp(p.pts[i - 1].x, p.pts[i].x, t), y: lerp(p.pts[i - 1].y, p.pts[i].y, t)};
      }
    }
    return p.pts[p.pts.length - 1];
  };

  function build(plan) {
    const G = plan.geo;
    const door = r => ({x: r.x + r.w / 2, y: r.y + r.d - 0.3});
    const exitPt = x => ({x: Math.max(2, Math.min(G.buildW - 2, x)), y: G.buildD + 0.4});
    const kerbLaneY = G.kerbY + G.kerbDepth * 0.62;
    const walkLaneY = G.kerbY + G.kerbDepth * 0.28;
    const streetLaneY = G.streetY + G.streetDepth * 0.45;

    const moves = plan.moves.map((mv, mvi) => {
      const room = G.rooms[mv.queueRoom] || null;
      const total = mv.sizes.reduce((t, v) => t + v, 0);
      const cap = mv.rides ? Math.max(1, mv.cap) : Math.max(1, mv.sizes[0] || 50);
      const nCo = mv.rides ? Math.max(1, Math.ceil(total / cap)) : mv.sizes.length;
      const co = [];
      let prevDepartAtBay = {};
      for (let c = 0; c < nCo; c++) {
        const size = mv.rides ? Math.min(cap, total - c * cap) : mv.sizes[c];
        const bay = G.bays.length ? c % G.bays.length : 0;
        const bayX = G.bays.length ? G.bays[bay] : G.buildW / 2;
        const qd = room ? door(room) : exitPt(G.buildW / 2);
        const ex = exitPt(qd.x);
        const kerbPt = {x: bayX, y: walkLaneY};
        const path = seg([qd, ex, {x: ex.x, y: G.kerbY + 0.8}, kerbPt]);
        const walkMin = path.total / WALK;
        // anchor on the departure the planner set, then work backwards through
        // boarding, the walk and the release, so "Out 8:00" means it leaves at 8:00
        // vehicles board before they leave; a walking party simply leaves at its time
        const boardDur = mv.rides ? Math.min(9, Math.max(1.6, size / 14)) : 0;
        let depart, firstKerb, rel, busArr;
        if (mv.rides) {
          depart = mv.s + c * 3.2;
          if (prevDepartAtBay[bay] != null) depart = Math.max(depart, prevDepartAtBay[bay] + 1.1);
          firstKerb = depart - 0.6 - boardDur;
          rel = firstKerb - walkMin;
          busArr = rel - 2.2;
          prevDepartAtBay[bay] = depart;
        } else {
          rel = mv.s + c * 1.6;
          firstKerb = rel + walkMin;
          depart = firstKerb;
          busArr = rel;
        }
        co.push({size, start: c * (mv.rides ? cap : 0) + (mv.rides ? 0 : mv.sizes.slice(0, c).reduce((t, v) => t + v, 0)),
                 bay, bayX, path, walkMin, busArr, rel, firstKerb, boardDur, depart,
                 stageX: -18 - c * 16});
      }
      // ingress leg mirrors at e
      const inCo = co.map((k, c) => {
        const busArr = mv.e - 1.5 + c * 3.5;
        return {...k, busArr, unloadStart: busArr + 0.6, unloadDur: Math.max(1.5, k.size / 18),
                depart: busArr + 0.6 + Math.max(1.5, k.size / 18) + 0.6};
      });
      return {...mv, mvi, room, total, cap, co, inCo,
              qRect: room ? {x: room.x, y: room.y + (room.headM || 1.6), w: room.w,
                             d: Math.max(1.2, room.d - (room.headM || 1.6) - 0.4)} : null};
    });

    // queue slot geometry, matching the authoring canvas
    // lanes continue past the back of the space: a queue that does not fit is SEEN
    // spilling out of the room rather than stacked invisibly on itself
    const slot = (rect, i) => {
      const s = 0.72, per = Math.max(1, Math.floor((rect.w - 0.6) / s));
      const lane = Math.floor(i / per), k = i % per, left = lane % 2 === 0;
      return {x: rect.x + 0.5 + (left ? k : per - 1 - k) * s,
              y: rect.y + 0.5 + lane * s * 1.6};
    };

    function at(T) {
      const people = [], vehicles = [];
      const counts = {queuing: 0, walking: 0, kerb: 0, boarding: 0, aboard: 0, busesAtKerb: 0, arriving: 0};
      moves.forEach(mv => {
        const active = T > mv.s - 70 && T < mv.e + 25;
        if (!active || !mv.total) return;
        const out = mv.dir !== 'in', back = mv.dir !== 'out';
        // ---- egress ----
        if (out) mv.co.forEach((k, c) => {
          // the coach
          if (mv.rides) {
            const appear = k.busArr - 2.6, gone = k.depart + 2.2;
            if (T >= appear && T <= gone) {
              let x, y = kerbLaneY, state;
              if (T < k.busArr) { const f = (T - appear) / 2.6; x = lerp(-16, k.bayX - mv.vlen / 2, f); y = lerp(streetLaneY, kerbLaneY, Math.min(1, f * 1.6)); state = 'approaching'; }
              else if (T <= k.depart) { x = k.bayX - mv.vlen / 2; state = T >= k.firstKerb ? 'loading' : 'at kerb'; counts.busesAtKerb++; }
              else { const f = (T - k.depart) / 2.2; x = lerp(k.bayX - mv.vlen / 2, G.buildW + 18, f); y = lerp(kerbLaneY, streetLaneY, Math.min(1, f * 1.8)); state = 'departing'; }
              const boarded = T < k.firstKerb ? 0
                : Math.min(k.size, Math.floor((T - k.firstKerb) / k.boardDur * k.size));
              counts.aboard += T > k.depart ? 0 : boarded;
              vehicles.push({x, y, l: mv.vlen, w: mv.vwid, hex: mv.vhex, label: mv.vname + ' ' + (c + 1),
                             occ: boarded, cap: mv.cap, state});
            }
          }
          for (let j = 0; j < k.size; j++) {
            const gi = k.start + j, h = hash(mv.key, gi);
            const tArr = k.rel - 34 + h * 26;      // the queue fills through the half hour before release
            const walkStart = k.rel + (j / k.size) * 1.2;
            const tKerb = walkStart + k.walkMin;
            const tBoard = k.firstKerb + (j / k.size) * k.boardDur;
            if (T < tArr - 1.4 || !mv.qRect) continue;
            if (T < tArr) {           // entering from the building door to the queue
              const d0 = door(mv.room), sl = slot(mv.qRect, j + (h > .5 ? 0 : 0));
              const f = 1 - (tArr - T) / 1.4;
              people.push({x: lerp(d0.x, sl.x, f), y: lerp(d0.y, sl.y, f), hex: mv.hex, mv: mv.name, st: 'entering', grp: k.size, room: mv.queueRoom});
              counts.arriving++;
            } else if (T < walkStart) {                     // queuing, advancing as cohorts leave
              const releasedBefore = mv.co.filter(z => z.rel <= T).reduce((t, z) => t + (z.rel <= T ? z.size : 0), 0);
              const idx = Math.max(0, gi - releasedBefore);
              const sl = slot(mv.qRect, idx);
              const off = (mv.mvi % 3) * 0.26;      // side by side, never on top of each other
              people.push({x: sl.x + off + (h - .5) * .22, y: sl.y + off * 0.5, hex: mv.hex,
                           mv: mv.name, st: 'queuing', grp: k.size, rel: k.rel, room: mv.queueRoom});
              counts.queuing++;
            } else if (mv.rides && T < tBoard) {
              if (T < tKerb) {                              // walking the route
                const f = (T - walkStart) / k.walkMin;
                const p = along(k.path, f);
                people.push({x: p.x + (h - .5) * 1.1, y: p.y + (h - .5) * .5, hex: mv.hex, mv: mv.name, st: 'walking to the kerb', grp: k.size, eta: tKerb});
                counts.walking++;
              } else {                                      // waiting at the kerb
                people.push({x: k.bayX - mv.vlen / 2 + (j % 14) * .74 - 5, y: walkLaneY + ((j / 14 | 0) % 2) * .8, hex: mv.hex, mv: mv.name, st: 'waiting to board', grp: k.size, eta: tBoard});
                counts.kerb++;
              }
            } else if (!mv.rides) {                         // on foot: out along the street and away
              const f = (T - walkStart) / (k.walkMin + 3.5);
              if (f < 1) {
                const p = along(k.path, Math.min(1, f * (k.walkMin + 3.5) / k.walkMin));
                const drift = f * (k.walkMin + 3.5) > k.walkMin ? (T - walkStart - k.walkMin) * 26 : 0;
                people.push({x: p.x + drift * (h > .5 ? 1 : -1) * 0.6 + (h - .5), y: p.y + (h - .5) * .6, hex: mv.hex, mv: mv.name, st: 'walking out', grp: k.size});
                counts.walking++;
              }
            } else if (T < tBoard + 0.15) counts.boarding++;
          }
        });
        // ---- ingress: coaches return and the hotel absorbs the flow ----
        if (back && mv.rides) mv.inCo.forEach((k, c) => {
          const appear = k.busArr - 2.4, gone = k.depart + 2;
          if (T >= appear && T <= gone) {
            let x, y = kerbLaneY, state;
            if (T < k.busArr) { const f = (T - appear) / 2.4; x = lerp(-16, k.bayX - mv.vlen / 2, f); y = lerp(streetLaneY, kerbLaneY, Math.min(1, f * 1.6)); state = 'returning'; }
            else if (T <= k.depart) { x = k.bayX - mv.vlen / 2; state = 'unloading'; counts.busesAtKerb++; }
            else { const f = (T - k.depart) / 2; x = lerp(k.bayX - mv.vlen / 2, G.buildW + 18, f); y = lerp(kerbLaneY, streetLaneY, Math.min(1, f * 1.8)); state = 'departing'; }
            const off = T < k.unloadStart ? 0 : Math.min(k.size, Math.floor((T - k.unloadStart) / k.unloadDur * k.size));
            vehicles.push({x, y, l: mv.vlen, w: mv.vwid, hex: mv.vhex, label: mv.vname + ' ' + (c + 1),
                           occ: k.size - off, cap: mv.cap, state});
          }
          for (let j = 0; j < k.size; j++) {
            const h = hash(mv.key + 'in', k.start + j);
            const tOff = k.unloadStart + (j / k.size) * k.unloadDur;
            const wDur = k.walkMin * (0.9 + h * .3);
            if (T < tOff || T > tOff + wDur) continue;
            const f = 1 - (T - tOff) / wDur;               // reverse of the egress path
            const p = along(k.path, f);
            people.push({x: p.x + (h - .5) * 1.1, y: p.y + (h - .5) * .5, hex: mv.hex, mv: mv.name, st: 'walking in from the coach', grp: k.size});
            counts.walking++;
          }
        });
      });
      return {people, vehicles, counts};
    }
    return {at, moves};
  }

  window.PRAXIS_SIM = {build};
})();
