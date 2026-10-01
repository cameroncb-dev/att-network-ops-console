"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bot, ChartColumn, Clock3, List, Menu } from "lucide-react"
import { FeedError, FeedLoading } from "@/components/feed-states"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { OPERATIONS_CLOCK_ISO } from "@/lib/incidents/clock"
import { formatStamp } from "@/lib/incidents/format"
import { isOpenState } from "@/lib/incidents/sla"
import { useIncidentStore } from "@/lib/incidents/store"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Incidents", icon: List },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/agent", label: "Ops Agent", icon: Bot },
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/incidents")
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLinks({ onDark = false }: { onDark?: boolean }) {
  const pathname = usePathname()
  return (
    <nav className="grid gap-1" aria-label="Console">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              onDark
                ? active
                  ? "bg-white/15 text-white"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
                : active
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { status, error, incidents, reload } = useIncidentStore()
  const openCount = incidents.filter((incident) => isOpenState(incident.state)).length

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-[oklch(0.24_0.045_255)] text-white lg:flex">
        <div className="border-b border-white/10 px-4 py-4">
          <p className="text-[11px] font-medium tracking-[0.14em] text-sky-200 uppercase">AT&T</p>
          <p className="mt-1 text-sm leading-5 font-semibold">Network Operations Console</p>
          <p className="mt-1 text-xs text-white/60">Experience layer over the incident record</p>
        </div>
        <div className="flex-1 px-3 py-4">
          <NavLinks onDark />
        </div>
        <p className="px-4 py-4 text-[11px] leading-4 text-white/50">
          Fictional feed for a portfolio. Not connected to production ServiceNow or Azure.
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-3 backdrop-blur md:px-5">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-[oklch(0.24_0.045_255)] text-white">
              <SheetHeader>
                <SheetTitle className="text-white">Network Operations</SheetTitle>
              </SheetHeader>
              <div className="px-2">
                {NAV.map((item) => {
                  const active = isActive(pathname, item.href)
                  const Icon = item.icon
                  return (
                    <SheetClose asChild key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                          active ? "bg-white/15 text-white" : "text-white/75",
                        )}
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </Link>
                    </SheetClose>
                  )
                })}
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-sm font-semibold">Network Operations</p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            {status === "ready" ? (
              <span className="hidden font-medium text-foreground sm:inline">{openCount} open</span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              <span className="hidden sm:inline">Ops clock</span>
              <span className="font-medium text-foreground">{formatStamp(OPERATIONS_CLOCK_ISO)}</span>
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-3 py-4 md:px-6 md:py-6">
          {status === "loading" ? <FeedLoading /> : null}
          {status === "error" ? <FeedError message={error ?? "The incident feed failed."} onRetry={reload} /> : null}
          {status === "ready" ? children : null}
        </main>
      </div>
    </div>
  )
}
