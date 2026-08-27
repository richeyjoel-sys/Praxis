// Hotel positions. Six are exact (from the Wayfinder map data); three are
// approximate and flagged as such until confirmed.
import type { HotelGeo } from '@/model/types'

export const GEO: Record<string, HotelGeo> = {
  'Hilton San Diego Bayfront': { lat: 32.704009, lon: -117.157661, exact: true },
  'Omni San Diego Hotel at the Ballpark': { lat: 32.707003, lon: -117.158694, exact: true },
  'Embassy Suites by Hilton San Diego Bay Downtown': { lat: 32.711955, lon: -117.170588, exact: true },
  'Courtyard by Marriott Downtown Little Italy': { lat: 32.722472, lon: -117.164877, exact: true },
  'Courtyard by Marriott San Diego Downtown': { lat: 32.715874, lon: -117.159401, exact: true },
  'Hilton Garden Inn San Diego Downtown/Bayside': { lat: 32.726196, lon: -117.171768, exact: true },
  'Courtyard Old Town San Diego': { lat: 32.7545, lon: -117.1965, exact: false },
  'Sheraton Mission Valley San Diego Hotel': { lat: 32.7735, lon: -117.158, exact: false },
  'Best Western San Diego Zoo/Sea World': { lat: 32.748, lon: -117.167, exact: false },
}
