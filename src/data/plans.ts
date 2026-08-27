// Published plans Praxis knows about, per hotel. Only real documents belong
// here — the finder reports honestly when it has nothing for a hotel.
import type { PlanHit } from '@/model/types'

export const PLANS: Record<string, PlanHit[]> = {
  'Hilton San Diego Bayfront': [
    {
      title: 'Hilton San Diego Bayfront — event space brochure',
      kind: 'PDF',
      year: '2022',
      src: 'plans/hilton-bayfront-event-space.pdf',
      where: 'In this project',
      note: 'Capacity charts and floor plans for the Indigo and Sapphire ballroom levels.',
      rooms: [
        'Indigo Ballroom',
        'Indigo Light Wall',
        'Indigo West Foyer',
        'Sapphire Ballroom',
        'Aqua Salon',
        'Main Lobby',
        'Porte Cochère',
      ],
    },
  ],
}

/** What the finder offers when it has no document: the searches a planner would run. */
export function planSearches(name: string, addr?: string) {
  return [
    { l: 'Event space brochure', q: `"${name}" event space brochure floor plan pdf` },
    { l: 'Meetings & capacity charts', q: `"${name}" meetings capacity chart pdf` },
    { l: 'Site aerial', q: `${addr || name} aerial site plan` },
  ].map((s) => ({ ...s, url: 'https://www.google.com/search?q=' + encodeURIComponent(s.q) }))
}
