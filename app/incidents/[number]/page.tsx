import { IncidentDetail } from "@/components/incidents/incident-detail";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return { title: number };
}

export default async function IncidentPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return <IncidentDetail number={number} />;
}
