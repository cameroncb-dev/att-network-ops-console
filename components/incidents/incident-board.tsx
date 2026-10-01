"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyCut } from "@/components/feed-states"
import { PriorityBadge, SlaText, StateBadge } from "@/components/status-badges"
import { formatStamp } from "@/lib/incidents/format"
import { filterIncidents, sortIncidents } from "@/lib/incidents/query"
import { useIncidentStore } from "@/lib/incidents/store"
import {
  ASSIGNMENT_GROUPS,
  DEFAULT_FILTERS,
  INCIDENT_STATES,
  PRIORITIES,
  SERVICES,
  type Incident,
  type IncidentFilters,
} from "@/lib/incidents/types"

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function filtersActive(filters: IncidentFilters) {
  return (
    filters.query.trim() !== "" ||
    filters.priority !== "all" ||
    filters.state !== "all" ||
    filters.assignmentGroup !== "all" ||
    filters.service !== "all"
  )
}

export function IncidentBoard() {
  const router = useRouter()
  const { incidents, filters, setFilters } = useIncidentStore()
  const visible = useMemo(() => sortIncidents(filterIncidents(incidents, filters)), [incidents, filters])
  const openInView = visible.filter((incident) => incident.state === "New" || incident.state === "In Progress" || incident.state === "On Hold").length

  function patch(partial: Partial<IncidentFilters>) {
    setFilters({ ...filters, ...partial })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Incident queue</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            ServiceNow-shaped network incidents for 5G RAN, fiber, enterprise VPN, and voice. Filters follow priority, state, assignment group, and service. {openInView} open in this view, {visible.length} shown of {incidents.length}.
          </p>
        </div>
        <Button variant="outline" disabled={!filtersActive(filters)} onClick={() => setFilters(DEFAULT_FILTERS)}>
          Clear filters
        </Button>
      </div>

      <div className="grid gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-6">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="incident-search">Search</Label>
          <Input
            id="incident-search"
            value={filters.query}
            placeholder="Number, CI, city, or description"
            onChange={(event) => patch({ query: event.target.value })}
          />
        </div>
        <FilterSelect
          id="filter-priority"
          label="Priority"
          value={filters.priority}
          onChange={(priority) => patch({ priority: priority as IncidentFilters["priority"] })}
          options={[{ value: "all", label: "All priorities" }, ...PRIORITIES.map((priority) => ({ value: priority, label: priority }))]}
        />
        <FilterSelect
          id="filter-state"
          label="State"
          value={filters.state}
          onChange={(state) => patch({ state: state as IncidentFilters["state"] })}
          options={[{ value: "all", label: "All states" }, ...INCIDENT_STATES.map((state) => ({ value: state, label: state }))]}
        />
        <FilterSelect
          id="filter-group"
          label="Assignment group"
          value={filters.assignmentGroup}
          onChange={(assignmentGroup) => patch({ assignmentGroup: assignmentGroup as IncidentFilters["assignmentGroup"] })}
          options={[{ value: "all", label: "All groups" }, ...ASSIGNMENT_GROUPS.map((group) => ({ value: group, label: group }))]}
        />
        <FilterSelect
          id="filter-service"
          label="Service"
          value={filters.service}
          onChange={(service) => patch({ service: service as IncidentFilters["service"] })}
          options={[{ value: "all", label: "All services" }, ...SERVICES.map((service) => ({ value: service, label: service }))]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyCut
          title="No incidents match these filters"
          body="Nothing in the feed matches this combination. Clear the filters to return to the full queue."
        />
      ) : (
        <>
          <div className="hidden md:block">
            <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead>Short description</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="hidden xl:table-cell">Region</TableHead>
                    <TableHead>Assignment group</TableHead>
                    <TableHead className="hidden lg:table-cell">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((incident) => (
                    <TableRow
                      key={incident.number}
                      className="cursor-pointer"
                      onClick={() => router.push(`/incidents/${incident.number}`)}
                    >
                      <TableCell>
                        <Link href={`/incidents/${incident.number}`} className="font-mono text-xs font-medium text-primary hover:underline" onClick={(event) => event.stopPropagation()}>
                          {incident.number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={incident.priority} />
                      </TableCell>
                      <TableCell>
                        <StateBadge state={incident.state} />
                      </TableCell>
                      <TableCell>
                        <SlaText incident={incident} />
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate">{incident.shortDescription}</TableCell>
                      <TableCell>{incident.service}</TableCell>
                      <TableCell className="hidden xl:table-cell">{incident.region}</TableCell>
                      <TableCell>{incident.assignmentGroup}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{formatStamp(incident.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="grid gap-3 md:hidden">
            {visible.map((incident) => (
              <IncidentCard key={incident.number} incident={incident} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <Link href={`/incidents/${incident.number}`} className="block rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium text-primary">{incident.number}</span>
        <SlaText incident={incident} />
      </div>
      <p className="mt-2 text-sm font-medium">{incident.shortDescription}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <PriorityBadge priority={incident.priority} />
        <StateBadge state={incident.state} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {incident.service} · {incident.region} · {incident.assignmentGroup}
      </p>
    </Link>
  )
}
