"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { EmptyCut } from "@/components/feed-states"
import { PriorityBadge, SlaText, StateBadge } from "@/components/status-badges"
import { formatStamp } from "@/lib/incidents/format"
import { slaTargetHours } from "@/lib/incidents/sla"
import { useIncidentStore } from "@/lib/incidents/store"
import { ASSIGNMENT_GROUPS, INCIDENT_STATES, type AssignmentGroup, type IncidentState } from "@/lib/incidents/types"

export function IncidentDetail({ number }: { number: string }) {
  const { incidents, updateIncident, addWorkNote } = useIncidentStore()
  const incident = incidents.find((item) => item.number === number)

  if (!incident) {
    return (
      <EmptyCut
        title={`${number} is not in the feed`}
        body="That incident number is not in the local seed. Return to the queue and open a record from the list."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/" className="text-xs font-medium text-primary hover:underline">
            Back to queue
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-lg font-semibold">{incident.number}</h1>
            <PriorityBadge priority={incident.priority} />
            <StateBadge state={incident.state} />
            <SlaText incident={incident} />
          </div>
          <p className="mt-2 text-sm text-foreground">{incident.shortDescription}</p>
        </div>
        <Button asChild>
          <Link href={`/agent?incident=${incident.number}`}>Run Ops Agent</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Opened" value={formatStamp(incident.openedAt)} />
        <Fact label="SLA due" value={formatStamp(incident.slaDueAt)} detail={`${slaTargetHours(incident.priority)}h target`} />
        <Fact label="Configuration item" value={incident.configurationItem} detail={`${incident.location} · ${incident.region}`} />
        <Fact label="Assigned to" value={incident.assignedTo} detail={incident.assignmentGroup} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
              <CardDescription>
                {incident.service} · {incident.source} · Impact {incident.impact} · Urgency {incident.urgency}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6">{incident.description}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Work notes</CardTitle>
              <CardDescription>Newest first. Notes you add are stamped just after the operations clock.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {incident.workNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No work notes on this incident yet.</p>
              ) : (
                [...incident.workNotes].reverse().map((note) => (
                  <article key={note.id} className="border-l-2 border-primary/40 pl-3">
                    <p className="text-xs text-muted-foreground">
                      {note.author} · {formatStamp(note.at)}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{note.text}</p>
                  </article>
                ))
              )}
              <NoteForm key={incident.number} number={incident.number} onAdd={addWorkNote} />
            </CardContent>
          </Card>
        </div>
        <AssignmentEditor
          key={`${incident.number}|${incident.state}|${incident.assignmentGroup}`}
          incidentNumber={incident.number}
          state={incident.state}
          assignmentGroup={incident.assignmentGroup}
          onSave={updateIncident}
        />
      </div>
    </div>
  )
}

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
      {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  )
}

function AssignmentEditor({
  incidentNumber,
  state,
  assignmentGroup,
  onSave,
}: {
  incidentNumber: string
  state: IncidentState
  assignmentGroup: AssignmentGroup
  onSave: (number: string, patch: { state: IncidentState; assignmentGroup: AssignmentGroup }) => boolean
}) {
  const [nextState, setNextState] = useState(state)
  const [nextGroup, setNextGroup] = useState(assignmentGroup)
  const dirty = nextState !== state || nextGroup !== assignmentGroup

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment</CardTitle>
        <CardDescription>Update state and assignment group on this console. The seed is the only store.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-1.5">
          <Label htmlFor="detail-state">State</Label>
          <Select value={nextState} onValueChange={(value) => setNextState(value as IncidentState)}>
            <SelectTrigger id="detail-state" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INCIDENT_STATES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="detail-group">Assignment group</Label>
          <Select value={nextGroup} onValueChange={(value) => setNextGroup(value as AssignmentGroup)}>
            <SelectTrigger id="detail-group" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNMENT_GROUPS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="w-full"
          disabled={!dirty}
          onClick={() => {
            const ok = onSave(incidentNumber, { state: nextState, assignmentGroup: nextGroup })
            if (ok) toast.success(`${incidentNumber} updated`)
            else toast.error(`${incidentNumber} is no longer in the feed`)
          }}
        >
          Save assignment
        </Button>
      </CardContent>
    </Card>
  )
}

function NoteForm({ number, onAdd }: { number: string; onAdd: (number: string, text: string) => boolean }) {
  const [text, setText] = useState("")

  return (
    <form
      className="space-y-2 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        const ok = onAdd(number, text)
        if (!ok) return
        setText("")
        toast.success(`Work note added to ${number}`)
      }}
    >
      <Label htmlFor="work-note">Add a work note</Label>
      <Textarea
        id="work-note"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="What changed, who owns the next action, and whether the alarm is still up."
        rows={4}
      />
      <Button type="submit" variant="secondary" disabled={text.trim().length === 0}>
        Add work note
      </Button>
    </form>
  )
}
