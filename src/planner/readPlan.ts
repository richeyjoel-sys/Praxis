// Reading an uploaded floor plan. A PDF page is rasterised so it can actually
// be traced; an image is used directly. The plan is on the canvas the moment
// it is read, at its own aspect, ready to trace.

import type { Model } from '@/model/select'
import * as A from '@/state/actions'
import { readFileAsDataUrl } from '@/ui'

async function readPdf(file: File) {
  const mod = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  mod.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await mod.getDocument({ data: await file.arrayBuffer() }).promise
  const page = await doc.getPage(1)
  const vp = page.getViewport({ scale: 1 })
  // sized to trace against, not to archive: the plan is saved with the project
  const scale = Math.min(1500 / vp.width, 1500 / vp.height, 2)
  const v2 = page.getViewport({ scale })
  const cv = document.createElement('canvas')
  cv.width = Math.round(v2.width)
  cv.height = Math.round(v2.height)
  const cx = cv.getContext('2d')!
  cx.fillStyle = '#fff'
  cx.fillRect(0, 0, cv.width, cv.height)
  await page.render({ canvasContext: cx, viewport: v2, canvas: cv }).promise
  return { src: cv.toDataURL('image/jpeg', 0.82), pages: doc.numPages, px: cv.width + ' × ' + cv.height }
}

function showUnderlay(m: Model, src: string, name: string) {
  const img = new Image()
  img.onload = () => {
    const wM = m.frame2().w
    A.setUnderlay2(m, {
      src,
      name,
      wM,
      hM: +(wM * (img.height / img.width)).toFixed(2),
      ar: img.height / img.width,
      ox: 0,
      oy: 0,
    })
    A.setPendingUpload(null)
    A.setView('planner')
    A.setPmode('plan')
    A.setDraftTool('wall') // the plan is down — the next step is tracing its walls
  }
  img.onerror = () => A.setPendingUpload({ name, src: null, failed: true, note: 'That file could not be read as an image here.' })
  img.src = src
}

export async function readPlanFile(m: Model, f: File) {
  const kb = Math.round(f.size / 1024)
  const isPdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)
  if (isPdf) {
    A.setPendingUpload({ name: f.name, src: null, reading: true, note: `${kb} KB PDF · reading page 1…` })
    try {
      const r = await readPdf(f)
      showUnderlay(m, r.src, f.name)
      A.setPendingUpload({ name: f.name, src: r.src, note: `Read page 1 of ${r.pages} at ${r.px}. It is on the canvas — set the scale, then trace the walls over it.` })
    } catch {
      A.setPendingUpload({
        name: f.name,
        src: null,
        failed: true,
        note: 'Could not read this PDF here. Open it alongside and size the spaces by hand, or upload a page as an image.',
      })
    }
    return
  }
  showUnderlay(m, await readFileAsDataUrl(f), f.name)
}
