/** Venues near LRT Bukit Jalil that event-scan watches, plus the geometry and title matching it validates and merges with. */

export const VENUES: { canonical: string; aliases: string[] }[] = [
  { canonical: 'TM Stadium Nasional', aliases: ['TM Stadium Nasional', 'Stadium Nasional Bukit Jalil', 'National Stadium Bukit Jalil', 'Bukit Jalil National Stadium'] },
  { canonical: 'Unifi Arena', aliases: ['Unifi Arena', 'Axiata Arena', 'Putra Indoor Stadium'] },
  { canonical: 'Bukit Jalil National Sports Complex', aliases: ['Bukit Jalil National Sports Complex', 'Kompleks Sukan Negara', 'National Sports Complex'] },
];

/** The canonical name of the first venue with an alias contained in `venue` (case-insensitive), or null. */
export function canonicalVenue(venue: string): string | null {
  const v = venue.toLowerCase();
  if (!v.trim()) return null;
  return VENUES.find((x) => x.aliases.some((a) => v.includes(a.toLowerCase())))?.canonical ?? null;
}

/** LRT Bukit Jalil. */
export const LRT_BUKIT_JALIL: [number, number] = [3.05813, 101.69222];

/** Haversine distance from `centre` is at most `km`. */
export function withinKm(lat: number, lng: number, km: number, centre: [number, number] = LRT_BUKIT_JALIL): boolean {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat - centre[0]);
  const dLng = rad(lng - centre[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(centre[0])) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))) <= km;
}

const STOP = new Set(['the', 'and', 'concert', 'tour', 'live', 'world', 'kuala', 'lumpur', '2026']);
const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)));

/** Jaccard similarity of the titles' word tokens (length >= 3, stop-words removed). Two token-less titles score 1 only when equal. */
export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
}
