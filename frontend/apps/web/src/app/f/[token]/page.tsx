import { PublicMarketingFormClient } from "../../../features/marketing/PublicMarketingFormClient";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ source?: string }>;
};

export default async function PublicFormPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const sourceRaw = (query.source ?? "LINK").toUpperCase();
  const source =
    sourceRaw === "CTA" || sourceRaw === "WEBSITE" || sourceRaw === "LINK"
      ? sourceRaw
      : "LINK";
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <PublicMarketingFormClient token={token} source={source} />
    </main>
  );
}
