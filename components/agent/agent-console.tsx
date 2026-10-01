"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { runAgentLoop } from "@/lib/agent/loop"
import type { AgentEvent, Recommendation, ToolName } from "@/lib/agent/types"
import { useIncidentStore } from "@/lib/incidents/store"
import { ASSIGNMENT_GROUPS, INCIDENT_STATES, type AssignmentGroup, type IncidentState } from "@/lib/incidents/types"

const TOOL_LABELS: Record<ToolName, string> = {
  search_incidents: "Search incidents",
  summarize_incident: "Summarize incident",
  recommend_assignment: "Recommend assignment",
  draft_work_note: "Draft work note",
  flag_repeat_patterns: "Flag repeat patterns",
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function AgentConsole() {
  const searchParams = useSearchParams()
  const preset = searchParams.get("incident")
  const { incidents, applyRecommendation } = useIncidentStore()
  const [mode, setMode] = useState<"queue" | "incident">(preset ? "incident" : "queue")
  const [number, setNumber] = useState(preset && incidents.some((incident) => incident.number === preset) ? preset : incidents[0]?.number ?? "")
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appliedId, setAppliedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<Recommendation | null>(null)
  const [draftState, setDraftState] = useState<IncidentState>("In Progress")
  const [draftGroup, setDraftGroup] = useState<AssignmentGroup>("NOC Tier 1")
  const [draftNote, setDraftNote] = useState("")
  const runId = useRef(0)

  const ordered = useMemo(
    () => [...incidents].sort((a, b) => a.number.localeCompare(b.number)),
    [incidents],
  )

  async function onRun() {
    const id = runId.current + 1
    runId.current = id
    setRunning(true)
    setError(null)
    setEvents([])
    setAppliedId(null)
    try {
      const scope = mode === "queue" ? ({ type: "queue" } as const) : ({ type: "incident", number } as const)
      const trace = runAgentLoop(scope, incidents)
      for (let index = 0; index < trace.length; index += 1) {
        await delay(160)
        if (runId.current !== id) return
        setEvents(trace.slice(0, index + 1))
      }
    } catch (reason) {
      if (runId.current === id) setError(reason instanceof Error ? reason.message : "The agent stopped.")
    } finally {
      if (runId.current === id) setRunning(false)
    }
  }

  function openApply(recommendation: Recommendation) {
    setDraft(recommendation)
    setDraftState(recommendation.proposedState)
    setDraftGroup(recommendation.proposedAssignmentGroup)
    setDraftNote(recommendation.workNote)
    setDialogOpen(true)
  }

  const recommendationEvent = [...events].reverse().find((event) => event.kind === "recommendation")

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ops Agent</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Runs on this console&apos;s incident feed. It writes a plan, calls tools against those records, and stops with a recommendation you can edit and apply. Nothing leaves the browser. The planner interface is the swap point for Azure OpenAI.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope</CardTitle>
          <CardDescription>Triage the open queue, or review one incident. Queue triage uses repeat patterns to break SLA-risk ties.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant={mode === "queue" ? "default" : "outline"} onClick={() => setMode("queue")} disabled={running}>
              Open queue
            </Button>
            <Button variant={mode === "incident" ? "default" : "outline"} onClick={() => setMode("incident")} disabled={running}>
              One incident
            </Button>
          </div>
          {mode === "incident" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="agent-incident">Incident</Label>
              <Select value={number} onValueChange={setNumber} disabled={running}>
                <SelectTrigger id="agent-incident" className="w-full md:max-w-xl">
                  <SelectValue placeholder="Choose an incident" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  {ordered.map((incident) => (
                    <SelectItem key={incident.number} value={incident.number}>
                      {incident.number} · {incident.shortDescription}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <Button onClick={onRun} disabled={running || (mode === "incident" && !number)}>
            {running ? "Running" : "Run Ops Agent"}
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Agent stopped</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {events.length > 0 ? (
        <ol className="space-y-3" aria-live="polite">
          {events.map((event, index) => (
            <li key={event.id}>
              <TraceStep event={event} index={index + 1} applied={appliedId === event.id} onApply={openApply} />
            </li>
          ))}
        </ol>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply recommendation</DialogTitle>
            <DialogDescription>
              {draft ? `This writes state, assignment group, and a work note on ${draft.incidentNumber}.` : "Review the change before it hits the feed."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="apply-state">State</Label>
              <Select value={draftState} onValueChange={(value) => setDraftState(value as IncidentState)}>
                <SelectTrigger id="apply-state" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="apply-group">Assignment group</Label>
              <Select value={draftGroup} onValueChange={(value) => setDraftGroup(value as AssignmentGroup)}>
                <SelectTrigger id="apply-group" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_GROUPS.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="apply-note">Work note</Label>
              <Textarea id="apply-note" rows={8} value={draftNote} onChange={(event) => setDraftNote(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={draftNote.trim().length === 0 || !draft}
              onClick={() => {
                if (!draft) return
                const ok = applyRecommendation({
                  number: draft.incidentNumber,
                  state: draftState,
                  assignmentGroup: draftGroup,
                  workNote: draftNote,
                })
                if (!ok) {
                  toast.error(`${draft.incidentNumber} could not be updated`)
                  return
                }
                if (recommendationEvent) setAppliedId(recommendationEvent.id)
                setDialogOpen(false)
                toast.success(`Recommendation applied to ${draft.incidentNumber}`)
              }}
            >
              Apply to feed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TraceStep({
  event,
  index,
  applied,
  onApply,
}: {
  event: AgentEvent
  index: number
  applied: boolean
  onApply: (recommendation: Recommendation) => void
}) {
  return (
    <article className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Step {index}</p>
      {event.kind === "plan" ? (
        <>
          <h2 className="mt-1 text-sm font-semibold">Plan</h2>
          <p className="mt-1 text-sm leading-6">{event.text}</p>
        </>
      ) : null}
      {event.kind === "tool_call" ? (
        <>
          <h2 className="mt-1 text-sm font-semibold">{TOOL_LABELS[event.tool]}</h2>
          <p className="mt-1 text-sm leading-6">{event.reason}</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-2 font-mono text-[11px] leading-4">{JSON.stringify(event.args, null, 2)}</pre>
        </>
      ) : null}
      {event.kind === "tool_result" ? (
        <>
          <h2 className="mt-1 text-sm font-semibold">{TOOL_LABELS[event.tool]} result</h2>
          <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{event.summary}</p>
          {event.recordNumbers.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {event.recordNumbers.map((number) => (
                <Link key={number} href={`/incidents/${number}`} className="font-mono text-xs text-primary hover:underline">
                  {number}
                </Link>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      {event.kind === "stop" ? (
        <>
          <h2 className="mt-1 text-sm font-semibold">No change recommended</h2>
          <p className="mt-1 text-sm leading-6">{event.text}</p>
        </>
      ) : null}
      {event.kind === "recommendation" ? (
        <>
          <h2 className="mt-1 text-sm font-semibold">Recommendation · {event.recommendation.incidentNumber}</h2>
          <p className="mt-1 text-sm">{event.recommendation.shortDescription}</p>
          <p className="mt-2 text-sm leading-6">{event.recommendation.rationale}</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">State</dt>
              <dd>
                {event.recommendation.currentState} → {event.recommendation.proposedState}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Assignment group</dt>
              <dd>
                {event.recommendation.currentAssignmentGroup} → {event.recommendation.proposedAssignmentGroup}
              </dd>
            </div>
          </dl>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-2 font-mono text-[11px] leading-4 whitespace-pre-wrap">{event.recommendation.workNote}</pre>
          <div className="mt-2 flex flex-wrap gap-2">
            {event.recommendation.evidenceNumbers.map((number) => (
              <Link key={number} href={`/incidents/${number}`} className="font-mono text-xs text-primary hover:underline">
                {number}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button disabled={applied} onClick={() => onApply(event.recommendation)}>
              {applied ? "Applied" : "Apply recommendation"}
            </Button>
            {applied ? (
              <Link href={`/incidents/${event.recommendation.incidentNumber}`} className="text-sm font-medium text-primary hover:underline">
                Open {event.recommendation.incidentNumber}
              </Link>
            ) : null}
          </div>
        </>
      ) : null}
    </article>
  )
}
