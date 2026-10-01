import { Badge } from "@/components/ui/badge"
import { slaLabel, slaStatus } from "@/lib/incidents/sla"
import type { Incident, IncidentState, Priority } from "@/lib/incidents/types"
import { cn } from "@/lib/utils"

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge
      variant={priority.startsWith("1") ? "destructive" : "outline"}
      className={cn(
        priority.startsWith("2") && "border-amber-300 bg-amber-50 text-amber-950",
        priority.startsWith("3") && "border-sky-200 bg-sky-50 text-sky-950",
      )}
    >
      {priority.split(" - ")[0]}
    </Badge>
  )
}

export function StateBadge({ state }: { state: IncidentState }) {
  return (
    <Badge
      variant={state === "In Progress" ? "default" : state === "Closed" ? "secondary" : "outline"}
      className={cn(
        state === "On Hold" && "border-amber-300 bg-amber-50 text-amber-950",
        state === "Resolved" && "border-emerald-300 bg-emerald-50 text-emerald-950",
        state === "New" && "border-primary/30 bg-primary/5 text-primary",
      )}
    >
      {state}
    </Badge>
  )
}

export function SlaText({ incident }: { incident: Incident }) {
  const status = slaStatus(incident)
  return (
    <span
      className={cn(
        "text-xs font-medium",
        (status === "breached" || status === "missed") && "text-destructive",
        status === "at-risk" && "text-amber-700",
        (status === "within" || status === "met") && "text-emerald-700",
      )}
    >
      {slaLabel(incident)}
    </span>
  )
}
