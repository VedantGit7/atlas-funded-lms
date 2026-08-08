import { redirect } from "next/navigation";

type LegacySettingsPageProps = {
  searchParams: Promise<{ setup?: string; next?: string }>;
};

/**
 * The monolithic /settings page was split into /profile (+ /profile/notifications,
 * /profile/security, /profile/danger-zone). This keeps old links (including the
 * admin MFA-setup redirect) working by forwarding to the right tab.
 */
export default async function LegacySettingsPage({ searchParams }: LegacySettingsPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.setup) query.set("setup", params.setup);
  if (params.next) query.set("next", params.next);
  const suffix = query.toString();

  const destination = params.setup === "mfa" ? "/profile/security" : "/profile";
  redirect(suffix ? `${destination}?${suffix}` : destination);
}
