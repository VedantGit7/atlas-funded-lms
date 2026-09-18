export const dynamic = "force-dynamic";

import { PublicEventPage } from "../../../../features/public/components/events/PublicEventPage";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PublicEventRoutePage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEventPage eventId={id} />;
}
