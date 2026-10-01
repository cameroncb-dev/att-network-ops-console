export function formatStamp(iso: string): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(new Date(iso))
  return `${formatted} UTC`
}

export function formatDay(isoDay: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDay}T00:00:00.000Z`))
}

export function formatHours(hours: number | null): string {
  if (hours == null || Number.isNaN(hours)) return "—"
  return `${(Math.round(hours * 10) / 10).toFixed(1)}h`
}

export function formatPercent(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—"
  return `${(Math.round(value * 10) / 10).toFixed(1)}%`
}
