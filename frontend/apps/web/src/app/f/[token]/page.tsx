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
    sourceRaw === "CTA" || sourceRaw === "WEBSITE" || sourceRaw === "LINK" ? sourceRaw : "LINK";
  return (
    <main className="min-h-screen bg-muted/50 text-foreground">
      <PublicMarketingFormClient token={token} source={source} />
    </main>
  );
}
