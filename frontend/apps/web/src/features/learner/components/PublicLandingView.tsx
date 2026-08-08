import Link from "next/link";
import type { PublicTenantBranding } from "../../../lib/server/public-tenant-branding";

type PublicLandingViewProps = {
  branding: PublicTenantBranding;
  requestId: string;
};

export function PublicLandingView({ branding, requestId }: PublicLandingViewProps) {
  return (
    <main className="space-y-8">
      <section className="space-y-4 rounded-lg border p-6">
        <p className="text-sm uppercase tracking-wide opacity-70">
          {branding.issuerName ?? "Academy"}
        </p>
        <h1 className="text-3xl font-semibold">{branding.publicName ?? "Welcome"}</h1>
        <p className="max-w-2xl text-sm opacity-80">
          Explore diagnostic assessment, sign in to continue learning, or create an account to join
          this academy.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/diagnostic" className="rounded-md border px-4 py-2 text-sm font-medium">
            Start diagnostic
          </Link>
          <Link href="/login" className="rounded-md border px-4 py-2 text-sm font-medium">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-md border px-4 py-2 text-sm font-medium">
            Create account
          </Link>
        </div>
      </section>
      <p className="text-xs opacity-60">Request ID: {requestId}</p>
    </main>
  );
}
