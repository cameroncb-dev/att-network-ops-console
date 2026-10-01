import { Suspense } from "react";
import { AgentConsole } from "@/components/agent/agent-console";
import { FeedLoading } from "@/components/feed-states";

export const metadata = {
  title: "Ops Agent",
};

export default function AgentPage() {
  return (
    <Suspense fallback={<FeedLoading />}>
      <AgentConsole />
    </Suspense>
  );
}
