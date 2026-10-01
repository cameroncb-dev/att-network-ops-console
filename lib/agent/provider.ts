import { AzureOpenAIPlanner } from "@/lib/agent/azure-openai-planner"
import { LocalHeuristicPlanner } from "@/lib/agent/local-planner"
import type { AgentPlanner } from "@/lib/agent/types"

/**
 * Local heuristic planner is the default so the console works offline.
 * Set NEXT_PUBLIC_AGENT_PROVIDER=azure-openai to select the Azure class.
 * That class refuses to run until endpoint, deployment, and key are configured.
 */
export function createPlanner(): AgentPlanner {
  if (process.env.NEXT_PUBLIC_AGENT_PROVIDER === "azure-openai") {
    return new AzureOpenAIPlanner()
  }
  return new LocalHeuristicPlanner()
}
