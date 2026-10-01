"use client"

import { ThemeProvider } from "next-themes"
import { ConsoleShell } from "@/components/console-shell"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { IncidentStoreProvider } from "@/lib/incidents/store"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
      <TooltipProvider>
        <IncidentStoreProvider>
          <ConsoleShell>{children}</ConsoleShell>
          <Toaster position="top-right" />
        </IncidentStoreProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
