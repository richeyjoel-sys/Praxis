# Praxis

Volunteer coverage and delegate-movement planner for IC26 San Diego — nine hotels, ten days.
A planner answers, per hotel per day: how many delegates move, when, by what transport, in how
many groups, from which space, and how many volunteers and signs that requires. The output is
a staffable plan, a floor plan you can draft on, and a 3D model that plays the day back.

## Run it

```
npm install
npm run dev        # http://localhost:5173
```

## Other scripts

```
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript, strict
npm run lint       # oxlint
npm run build      # production build → dist/ (installable PWA)
npm run preview    # serve dist/ locally
npm run screens    # screenshots + the layout invariant (needs `npm i -D playwright && npx playwright install chromium`)
node scripts/import-prototype-data.mjs   # regenerate src/data/matrix.generated.ts from prototype/praxis-data.js
```

## Layout

- `src/` — the app. See `docs/ARCHITECTURE.md` for the module map and the rules.
- `prototype/` — the Claude Design prototype this was ported from. Reference only; not built.
- `scripts/` — data generation.
- `docs/` — architecture and decisions.

## Deploy

Pushes to `main` deploy on Vercel (framework preset: Vite, build `npm run build`, output `dist`).
