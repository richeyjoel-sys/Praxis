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
| `planner/` | Planner chrome (modes, drawers, tools, finder, upload, clock bar), `buildScene.ts` (the Scene contract both surfaces read), `readPlan.ts` (PDF/image underlay) | `Praxis.dc.html` |
| `planner/plan/` | Plan mode: `PlanSurface` — SVG drafting, trace, calibrate, establish flow, OSM pull | `praxis-plan.js` |
| `planner/live/` | Go live: `LiveModel` — three.js model, camera presets, layers, overlays | `praxis-3d.js` |
| `sim/` | Deterministic simulation `build(plan).at(T)` — pure, no DOM, unit-tested | `praxis-sim.js` |
| `data/` | Event data: hotels, dates, activity groups (generated from the Mucho Matrix workbook), geo, known floor plans, scene defaults | `praxis-data.js`, `praxis-geo.js`, `praxis-plans.js`, `praxis-scene.js` |
| `ui/` | Shared controls: buttons, steppers, chips, popover, drawer | — |
| `lib/` | Small pure helpers: shortcuts, units, colour, ids | — |

`scripts/import-prototype-data.mjs` regenerates `src/data/matrix.generated.ts` from the
prototype's `praxis-data.js`; `scripts/build-data.mjs` (to write, once the Mucho Matrix
workbook is in the repo) will rebuild it from the spreadsheet so the data module is
reproducible rather than a hand-carried blob.

## The Scene contract

`buildScene(model)` produces the one object both view surfaces read every frame — the sim
plan, the placed and derived objects, layers, selection, the plan tool — and the callbacks
they write back through (`onRoom`, `onItem`, `onPlace`, `onTrace`, `onCalibrate`,
`onEstablish`, …). Every callback dispatches a named action in `state/actions.ts`. The
surfaces own nothing but the view: `PlanSurface` and `LiveModel` are imperative classes
mounted by thin React wrappers (`PlanCanvas`, `LiveCanvas`) that hand them a `getScene()`
getter, so a re-render never remounts a canvas.

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
- Wall height is fixed at 3.15 m until the "how tall are the walls" step is built.

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
