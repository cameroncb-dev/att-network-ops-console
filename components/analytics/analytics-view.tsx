"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyCut } from "@/components/feed-states"
import { formatDay, formatHours, formatPercent } from "@/lib/incidents/format"
import { computeAnalytics } from "@/lib/incidents/metrics"
import { sliceIncidents } from "@/lib/incidents/query"
import { useIncidentStore } from "@/lib/incidents/store"
import { REGIONS, SERVICES, type Region, type Service } from "@/lib/incidents/types"

const volumeConfig = {
  count: { label: "Incidents", color: "var(--chart-1)" },
} satisfies ChartConfig

const statusConfig = {
  open: { label: "Open", color: "var(--chart-1)" },
  resolved: { label: "Resolved", color: "var(--chart-2)" },
} satisfies ChartConfig

const trendConfig = {
  opened: { label: "Opened", color: "var(--chart-1)" },
  resolved: { label: "Resolved", color: "var(--chart-2)" },
} satisfies ChartConfig

const mttrConfig = {
  hours: { label: "Hours", color: "var(--chart-3)" },
} satisfies ChartConfig

export function AnalyticsView() {
  const { incidents, reload } = useIncidentStore()
  const [service, setService] = useState<Service | "all">("all")
  const [region, setRegion] = useState<Region | "all">("all")

  const sliced = useMemo(() => sliceIncidents(incidents, { service, region }), [incidents, service, region])

  const computed = useMemo(() => {
    try {
      return { analytics: computeAnalytics(sliced), error: null as string | null }
    } catch (reason) {
      return { analytics: null, error: reason instanceof Error ? reason.message : "Analytics could not be computed." }
    }
  }, [sliced])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Queue analytics</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Figures are computed from the in-memory incident feed, including any state, assignment, or note you apply. SLA attainment counts resolved and closed records that met the clock, plus open records already past due. Open records still inside the window are not scored yet.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:grid-cols-2 lg:max-w-xl">
        <div className="grid gap-1.5">
          <Label htmlFor="analytics-service">Service</Label>
          <Select value={service} onValueChange={(value) => setService(value as Service | "all")}>
            <SelectTrigger id="analytics-service" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {SERVICES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="analytics-region">Region</Label>
          <Select value={region} onValueChange={(value) => setRegion(value as Region | "all")}>
            <SelectTrigger id="analytics-region" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {REGIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {computed.error ? (
        <div className="space-y-3">
          <EmptyCut title="Analytics could not be computed" body={computed.error} />
          <Button variant="outline" onClick={reload}>
            Reload the feed
          </Button>
        </div>
      ) : null}

      {computed.analytics && computed.analytics.total === 0 ? (
        <EmptyCut
          title="No incidents in this cut"
          body="This service and region combination has no records in the feed. Voice in the West, fiber in the West, and enterprise VPN in the Southwest are empty on purpose."
        />
      ) : null}

      {computed.analytics && computed.analytics.total > 0 ? <AnalyticsBody analytics={computed.analytics} /> : null}
    </div>
  )
}

function AnalyticsBody({ analytics }: { analytics: NonNullable<ReturnType<typeof computeAnalytics>> }) {
  const serviceData = analytics.byService.map((row) => ({ name: row.service, count: row.count }))
  const regionData = analytics.byRegion.map((row) => ({ name: row.region, count: row.count }))
  const mttrData = analytics.mttrByService.map((row) => ({ name: row.service, hours: Math.round(row.hours * 10) / 10 }))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Open" value={String(analytics.open)} detail="New, in progress, and on hold" />
        <Metric label="Resolved" value={String(analytics.resolved)} detail="Resolved and closed" />
        <Metric
          label="SLA attainment"
          value={formatPercent(analytics.slaAttainment)}
          detail={analytics.slaEvaluated ? `${analytics.slaMet} met of ${analytics.slaEvaluated} evaluated` : "Nothing evaluated"}
        />
        <Metric label="Mean time to resolve" value={formatHours(analytics.mttrHours)} detail="Resolved and closed records only" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Volume by service" description="Count of incidents in the current cut.">
          <ChartContainer config={volumeConfig} className="aspect-auto h-[240px] w-full">
            <BarChart data={serviceData} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title="Volume by region" description="Same incidents, grouped by operating region.">
          <ChartContainer config={volumeConfig} className="aspect-auto h-[240px] w-full">
            <BarChart data={regionData} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title="Open vs resolved" description="Resolved includes closed records.">
          <ChartContainer config={statusConfig} className="aspect-auto h-[240px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie data={analytics.openVsResolved} dataKey="count" nameKey="status" innerRadius={52} outerRadius={80} strokeWidth={2}>
                {analytics.openVsResolved.map((row) => (
                  <Cell key={row.status} fill={`var(--color-${row.status})`} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title="Mean time to resolve by service" description="Hours from open to resolve. Services with no resolved records are omitted.">
          {mttrData.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">No resolved incidents in this cut yet.</p>
          ) : (
            <ChartContainer config={mttrConfig} className="aspect-auto h-[240px] w-full">
              <BarChart data={mttrData} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
                <YAxis width={32} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="hours" fill="var(--color-hours)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Opened and resolved by day" description="UTC days ending on the operations clock. Opened uses the open timestamp. Resolved uses the resolve timestamp.">
        <ChartContainer config={trendConfig} className="aspect-auto h-[260px] w-full">
          <LineChart data={analytics.trend} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={formatDay} minTickGap={24} />
            <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatDay(String(value))} />} />
            <Line type="monotone" dataKey="opened" stroke="var(--color-opened)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="resolved" stroke="var(--color-resolved)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </ChartCard>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
