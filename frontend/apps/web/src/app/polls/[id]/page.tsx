export const dynamic = "force-dynamic";

import { PageGate } from "../../../components/patterns/PageGate";
import { LearnerPollCard } from "../../../features/polls/LearnerPollCard";

type PollPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LearnerPollPage({ params }: PollPageProps) {
  const { id } = await params;

  return (
    <PageGate state="ready" title="Poll">
      <LearnerPollCard pollId={id} />
    </PageGate>
  );
}
