// Praxis scene model — everything here is in real metres.
// The 2D authoring canvas and (later) the 3D view both read these helpers,
// so a queue that does not fit a room does not fit in either view.
(function () {
  const M = {};

  // ---- units -------------------------------------------------------------
  M.FT = 0.3048;
  M.ft = m => m / M.FT;
  M.m = ft => ft * M.FT;
  // metres per pixel at a given latitude and web-mercator zoom, 256px tiles
  M.mPerPx = (lat, zoom) => 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);

  // ---- default building envelope ----------------------------------------
  // A plain rectangle until the planner traces the real outline or uploads a plan.
  M.defaultSite = () => ({
    w: 64, d: 42,              // building envelope, metres
    kerb: 7,                   // depth of the front drive
    street: 9,                 // depth of the public road
    origin: {x: 0, y: 0},
    trace: null,               // [[x,y], …] metres, once traced off the map
    plan: null,                // {src, x, y, w, h} uploaded underlay, metres
    scaleRef: null             // {ax, ay, bx, by, metres} calibration line
  });

  // Rooms carry real footprints. Anything without one gets a sensible default
  // so an existing plan keeps working the moment the scene turns metric.
  M.defaultRoom = (id, i, site) => {
    const cols = 3, w = (site.w - 4) / cols - 2, d = 12;
    const col = i % cols, row = Math.floor(i / cols);
    return {x: 2 + col * (w + 2), y: 2 + row * (d + 2), w, d, rot: 0};
  };

  // ---- real hotels ------------------------------------------------------
  // Bayfront's arrival level, from the hotel's own Floorplans & Capacities sheet.
  // Dimensions are the published room sizes in feet, converted to metres.
  M.SEED = {
    'Hilton San Diego Bayfront': {
      w: 68, d: 51.5, kerb: 6.6, street: 8,
      kerbName: 'Porte Cochère · Park Blvd frontage',
      streetName: 'Park Boulevard',
      spaces: [
        {id: 'indigo', l: 'Indigo Ballroom', sub: '23,598 sq ft · 114 × 207 ft',
         x: 2.5, y: 2.5, w: 63.1, d: 34.7, tone: 'quiet'},
        {id: 'lobby', l: 'Main Lobby', sub: 'hotel entrance · front desk',
         x: 2.5, y: 39, w: 27.4, d: 10.5, tone: 'lit'},
        {id: 'lightwall', l: 'Indigo Light Wall', sub: 'registration area',
         x: 31.5, y: 39, w: 16, d: 10.5, tone: 'lit'},
        {id: 'westfoyer', l: 'Indigo West Foyer', sub: '9,774 sq ft pre-function',
         x: 49.1, y: 39, w: 10.4, d: 10.5, tone: 'quiet'},
        {id: 'lifts', l: 'Elevators', sub: 'to Aqua and Sapphire',
         x: 61.1, y: 39, w: 4.5, d: 10.5, tone: 'furn'}
      ]
    }
  };

  // ---- packing -----------------------------------------------------------
  // People are 0.5 m across and stand 0.7 m apart — the spacing a real queue
  // holds. This is what makes "does it fit" answerable.
  M.PERSON = 0.5;
  M.SPACING = 0.72;

  // Fill a rectangle row by row. Returns the points that fit plus the overflow
  // count, so the scene can show a queue spilling out of its space.
  M.packRect = (rect, n, spacing) => {
    const s = spacing || M.SPACING;
    const cols = Math.max(1, Math.floor((rect.w - 0.4) / s));
    const rows = Math.max(1, Math.floor((rect.d - 0.4) / s));
    const cap = cols * rows, out = [];
    const show = Math.min(n, cap);
    for (let i = 0; i < show; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      out.push({x: rect.x + 0.4 + c * s, y: rect.y + 0.4 + r * s});
    }
    return {pts: out, over: Math.max(0, n - cap), cap};
  };

  // A queue is a snake of lanes inside its space, so its length is physical.
  M.packQueue = (rect, n, spacing) => {
    const s = spacing || M.SPACING;
    const per = Math.max(1, Math.floor((rect.w - 0.6) / s));
    const lanes = Math.max(1, Math.floor((rect.d - 0.6) / (s * 1.6)));
    const cap = per * lanes, out = [];
    for (let i = 0; i < Math.min(n, cap); i++) {
      const lane = Math.floor(i / per), k = i % per;
      const left = lane % 2 === 0;
      out.push({
        x: rect.x + 0.5 + (left ? k : per - 1 - k) * s,
        y: rect.y + 0.5 + lane * s * 1.6,
        lane
      });
    }
    return {pts: out, over: Math.max(0, n - cap), cap, lanes, per};
  };

  // Line the front edge of a rect — greeters at a door, pick-ups along a kerb.
  M.packEdge = (rect, n, edge, spacing) => {
    const s = spacing || 1.1, out = [];
    const along = edge === 'left' || edge === 'right' ? rect.d : rect.w;
    const fit = Math.max(1, Math.floor((along - 0.6) / s));
    for (let i = 0; i < Math.min(n, fit); i++) {
      const t = 0.5 + (i % fit) * s;
      out.push(edge === 'top' ? {x: rect.x + t, y: rect.y + 0.6}
             : edge === 'bottom' ? {x: rect.x + t, y: rect.y + rect.d - 0.6}
             : edge === 'left' ? {x: rect.x + 0.6, y: rect.y + t}
             : {x: rect.x + rect.w - 0.6, y: rect.y + t});
    }
    return {pts: out, over: Math.max(0, n - fit), cap: fit};
  };

  // ---- vehicles ----------------------------------------------------------
  // Real footprints, so four coaches at a kerb take the room four coaches take.
  M.VEHICLE = {
    coach:   {l: 13.7, w: 2.6},
    shuttle: {l: 8.0,  w: 2.4},
    van:     {l: 5.9,  w: 2.1},
    car:     {l: 4.8,  w: 1.9}
  };
  M.vehicleBox = t => {
    const seats = t && t.seats || 0;
    if (seats >= 40) return M.VEHICLE.coach;
    if (seats >= 15) return M.VEHICLE.shuttle;
    if (seats >= 6) return M.VEHICLE.van;
    return M.VEHICLE.car;
  };

  // ---- routes ------------------------------------------------------------
  M.pathLength = pts => {
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return d;
  };
  M.WALK_SPEED = 1.25;                       // metres per second, crowd pace
  M.walkSeconds = pts => M.pathLength(pts) / M.WALK_SPEED;
  // position along a path at fraction t — people travel, they do not teleport
  M.along = (pts, t) => {
    const total = M.pathLength(pts);
    if (!total) return pts[0];
    let want = Math.max(0, Math.min(1, t)) * total;
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (want <= seg) {
        const f = seg ? want / seg : 0;
        return {x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
                y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f};
      }
      want -= seg;
    }
    return pts[pts.length - 1];
  };

  window.PRAXIS_SCENE = M;
})();
