// Ids that sort by creation and never collide within a session.
let last = 0
export function uid(prefix: string): string {
  let t = Date.now()
  if (t <= last) t = last + 1
  last = t
  return prefix + t.toString(36) + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')
}
