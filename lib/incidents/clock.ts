/** Frozen operations clock so SLA math stays stable across refreshes. */
export const OPERATIONS_CLOCK_ISO = "2026-10-01T22:00:00.000Z"
export const OPERATIONS_CLOCK_MS = Date.parse(OPERATIONS_CLOCK_ISO)

export function hoursAgoIso(hoursAgo: number, origin = OPERATIONS_CLOCK_MS): string {
  return new Date(origin - hoursAgo * 60 * 60 * 1000).toISOString()
}
