// Screenshots of the built app plus the layout invariant, for review.
//   npm run build && npm run preview &   then   node scripts/screens.mjs
// Needs Playwright (npm i -D playwright && npx playwright install chromium).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.PRAXIS_URL || 'http://localhost:4173/'
const HOTEL = 'Omni San Diego Hotel at the Ballpark'
mkdirSync('screens', { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await p.goto(URL, { waitUntil: 'networkidle' })
await p.screenshot({ path: 'screens/01-home.png' })
await p.click('nav[aria-label="Hotels"] button:nth-of-type(2)')
await p.waitForTimeout(500)
await p.screenshot({ path: 'screens/02-builder.png' })
await p.click('button[aria-label="Expand"] >> nth=0')
await p.waitForTimeout(300)
await p.screenshot({ path: 'screens/03-cascade.png' })
await p.click('text=Flow planner')
await p.waitForTimeout(3000)
await p.screenshot({ path: 'screens/04-live.png' })
await p.getByRole('button', { name: 'Plan', exact: true }).click()
await p.waitForTimeout(1200)
await p.screenshot({ path: 'screens/05-plan.png' })

// the layout invariant: the planner body never scrolls internally
for (const [w, h] of [[1440, 900], [540, 720]]) {
  await p.setViewportSize({ width: w, height: h })
  await p.waitForTimeout(600)
  const inv = await p.evaluate(() => {
    const b = [...document.querySelectorAll('div')].find((d) => d.getAttribute('data-planner') === 'true')
    return b ? { client: b.clientHeight, scroll: b.scrollHeight } : null
  })
  if (!inv || inv.scroll > inv.client + 1) errors.push(`layout invariant failed at ${w}×${h}: ${JSON.stringify(inv)}`)
  await p.screenshot({ path: `screens/09-planner-${w}.png` })
}
await b.close()
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('screens written, invariant holds; hotel:', HOTEL)
