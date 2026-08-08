import { BrandLoadingScreen } from "@/components/patterns/BrandLoadingScreen";

type RouteLoadingFallbackProps = Readonly<{
  title: string;
  variant?: "page" | "dashboard";
}>;

/**
 * Route-level loading fallback. Renders the site-wide branded loading screen so
 * every `loading.tsx` shows the same FundedBeyond Academy waiting state instead
 * of bare skeleton boxes. `variant` is retained for call-site compatibility.
 */
export function RouteLoadingFallback({ title }: RouteLoadingFallbackProps) {
  return <BrandLoadingScreen label={title} />;
}
