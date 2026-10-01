import type { AgentDecision, AgentPlanner, PlannerInput } from "@/lib/agent/types"

/**
 * Swap-in shape for Azure OpenAI. The loop does not care which planner
 * produced the next tool call. This class is not wired by default and does
 * not call the network.
 *
 * To use it later:
 * 1. Deploy a tool-calling model on Azure OpenAI.
 * 2. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT, and AZURE_OPENAI_API_KEY.
 * 3. Return this class from createPlanner() when NEXT_PUBLIC_AGENT_PROVIDER=azure-openai.
 * 4. Implement plan() and decide() with the same PlannerInput the local planner sees.
 *    Tool execution stays in lib/agent/tools.ts so the model never writes the incident feed itself.
 */
export class AzureOpenAIPlanner implements AgentPlanner {
  readonly id = "azure-openai" as const

  plan(input: PlannerInput): string {
    const scope = input.scope.type === "incident" ? input.scope.number : "the open queue"
    throw new Error(
      `Azure OpenAI planner is not configured for ${scope}. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT, and AZURE_OPENAI_API_KEY, then implement this class. The console is still running the local planner.`,
    )
  }

  decide(input: PlannerInput): AgentDecision {
    return { type: "stop", text: this.plan(input) }
  }
}
