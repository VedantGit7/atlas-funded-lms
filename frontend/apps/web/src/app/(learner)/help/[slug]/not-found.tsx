import Link from "next/link";
import { EmptyState } from "@atlas/design-system";
import { helpPrimaryButtonClassName } from "../../../../features/help-center/help-center-styles";

export default function HelpNotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <EmptyState
        title="Article not found"
        description="The link may be outdated or the article may have moved. Search from the Help Center home to find what you need."
      />
      <Link href="/help" className={`${helpPrimaryButtonClassName} mt-8`}>
        Back to Help Center
      </Link>
    </main>
  );
}
