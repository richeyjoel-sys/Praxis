# Praxis — architecture

Praxis plans volunteer coverage and delegate movement for a ten-day convention across nine
San Diego hotels. This document is the map of the rebuilt codebase: where things live, the
rules that hold it together, and the invariants worth checking before merging a change.

The product rule that governs the whole app: **the builder decides, the planner draws.**
Anything the Schedule builder settles appears in the Flow planner without being placed by hand.

## Layout of `src/`

| Directory | Owns | Prototype origin |
|---|---|---|
| `app/` | Shell, rail, surface switch, global shortcuts | `Praxis.dc.html` chrome |
| `state/` | The one state tree, `mutate()`/undo, persistence | `Praxis.dc.html` React class |
| `builder/` | Schedule builder: shift cards, roles, captains, movements, six-step cascade | `Praxis.dc.html` |
| `studio/` | Setup studio (Activities, Roles, Transport, Signage), Event & dates, logo colour extraction | `Praxis.dc.html` |
| `planner/` | Planner chrome (Draft/Go live, drawers, selection chips, establish card, clock bar), `buildScene2.ts` (the SceneV2 contract both surfaces read), `readPlan.ts` (PDF/image underlay) | rework, Aug 2026 |
| `planner/draft/` | Draft mode: `DraftSurface` — SVG drafting with the wall tool, queue spaces, calibrate, OSM pull, direct manipulation | rework |
| `planner/live/` | Go live: `LiveModel` — three.js; walls extruded from the traced runs, world-positioned objects, select/drag in 3D | `praxis-3d.js`, reworked |
| `sim/` | Deterministic simulation `build(plan).at(T)` — pure, no DOM, unit-tested | `praxis-sim.js` |
| `data/` | Event data: hotels, dates, activity groups (generated from the Mucho Matrix workbook), geo, known floor plans, scene defaults | `praxis-data.js`, `praxis-geo.js`, `praxis-plans.js`, `praxis-scene.js` |
| `ui/` | Shared controls: buttons, steppers, chips, popover, drawer | — |
| `lib/` | Small pure helpers: shortcuts, units, colour, ids | — |

`scripts/import-prototype-data.mjs` regenerates `src/data/matrix.generated.ts` from the
prototype's `praxis-data.js`; `scripts/build-data.mjs` (to write, once the Mucho Matrix
workbook is in the repo) will rebuild it from the spreadsheet so the data module is
reproducible rather than a hand-carried blob.

## The planner: site model v2 — one flow

The planner was rebuilt (28 Aug 2026) around one flow per hotel:

**blank → footprint (upload a plan / pull the map / draw) → walls → places → Go live.**

- Every hotel except Bayfront starts truly blank — ground, kerb, road, nothing else —
  until a footprint source is chosen. Bayfront's seed (and any old v1 save) migrates
  automatically in `model/site2.ts`.
- `SiteV2` (per hotel, `doc.sites2`): an underlay (PDF page / image / georeferenced OSM
  pull), `walls` as real polylines traced with the wall tool (any angle, 45° snap, live
  length labels), `wallH` (the "how tall are the walls" answer, default 3.15 m), `spaces`
  (drawn queue regions the simulation fills — separate from walls), and `items` at world
  coordinates.
- Direct manipulation everywhere: click selects, drag moves (items, walls, wall vertices,
  spaces), corner handles resize, right-click opens the tool menu, ⌫ deletes — in Draft
  and, for objects, in the 3D view too.
- Go live extrudes exactly the traced walls (one box per segment at `wallH`) — no
  placeholder building, no tower.

`buildScene2(model)` produces the `SceneV2` both surfaces read every frame; every callback
dispatches a named action in `state/actions.ts`. The surfaces own nothing but the view:
`DraftSurface` and `LiveModel` are imperative classes mounted by thin React wrappers
(`DraftCanvas`, `LiveCanvas`) that hand them a `getScene()` getter, so a re-render never
remounts a canvas.

## State

One tree (`state/types.ts`), one store (`state/store.ts`). Two ways to change it:

- `mutate(producer)` — every user edit. Snapshots the undoable slice onto a 24-deep stack
  first. ⌘Z undoes anything: a role count, a traced space, a palette change, a dropped day.
- `set(producer)` — transient UI (which surface, zoom, selection). Persisted, not undoable.

Nothing is derived twice: derived objects (signs per group, queue lanes) are computed from
the tree by selectors, never stored back into it.

Persistence is localStorage, debounced 400 ms, versioned. A corrupt entry is ignored rather
than losing the session.

## Product rules (enforced, check before merging)

1. No modal dialogs. Drill-in is a drawer, small choices are popovers, the establish flow is
   a strip on the canvas.
2. One shift selector in the whole app.
3. Never dim text to show "not current" — use a quieter surface (`--color-neutral-200`).
4. Status never relies on colour alone — every state carries a glyph.
5. 40 px minimum control height, everywhere (`--control-h`).
6. Every action prints its keyboard shortcut (`lib/shortcuts.ts` → `label()`).
7. No money anywhere.

## Layout invariant

The prototype's dominant defect class was a fixed-height or sticky element overlaying or
squeezing the plan canvas. The rebuilt shell holds this structurally:

- The shell fills `100dvh` exactly; the hotel body is the ONE scroller.
- Chrome reserves space as a flex row; nothing is `position: sticky`.
- The plan pane fits its scroller with zero internal scroll: `scroller.clientHeight ===
  scroller.scrollHeight`. `npm run screens` asserts this at 1440 px and 540 px viewports
  and writes review screenshots to `screens/`.

## Service worker

Network-first for the app shell and its data; cache is the offline fallback only. A
cache-first worker served stale builds during review and made rounds disagree about what
was on screen. OSM tiles are the exception (cache-first, 30 days).

## Assumptions carried from the prototype, all labelled in the UI

- Volunteer ratios are proposed, not given: 1 Pick-Up per 50 delegates on bus movements,
  1 Greeter per 150, Desk 1–2. The workbook has no volunteer data.
- Coach capacity 48 seats.
- Only Hilton Bayfront has real space names; the other eight hotels are placeholders.
- Wall height defaults to 3.15 m; the Site drawer's "Wall height" stepper sets it per hotel.

## Dropped from the prototype

Two things present in the prototype's script but unreachable from its UI were not ported:
a per-zone "canvas" placement mode (superseded by Plan mode) and a "Fleet" tab (its
numbers live in the movement rows and the header stats).

## Fixed during the port

- The Plan surface's overlay was rebuilt every 400 ms, discarding text typed into the
  calibrate and rename inputs. It now skips the rebuild while one of its inputs has focus.
- Right-click on the plan hit-tested the event target, which the redraw could invalidate;
  it now hit-tests by position.
- The sim's queue-head offset depended on screen pixels-per-metre; it is now a fixed
  1.6 m (0.6 m on the kerb and street), so the simulation is the same at every zoom.
- The prototype drew a placeholder building (the "Bayfront everywhere" bug) at every
  hotel; hotels now start blank, and a movement with no queue space simply sets off from
  the door instead of queuing in an invented lobby.
