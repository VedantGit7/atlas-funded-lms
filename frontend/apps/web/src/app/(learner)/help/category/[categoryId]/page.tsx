import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageGate } from "../../../../../components/patterns/PageGate";
import { HelpCategoryPage } from "../../../../../features/help-center/components/HelpCategoryPage";
import {
  HELP_CATEGORIES,
  getHelpCategory,
} from "../../../../../features/help-center/help-center-content";
import { loadPublicBootstrap } from "../../../../../lib/server/bootstrap";

type HelpCategoryRouteProps = {
  params: Promise<{ categoryId: string }>;
};

export function generateStaticParams() {
  return HELP_CATEGORIES.map((category) => ({ categoryId: category.id }));
}

export async function generateMetadata({ params }: HelpCategoryRouteProps): Promise<Metadata> {
  const { categoryId } = await params;
  const category = getHelpCategory(categoryId);

  if (!category) {
    return { title: "Category not found" };
  }

  return {
    title: `${category.title} | Help Center`,
    description: category.description,
  };
}

export default async function HelpCategoryRoute({ params }: HelpCategoryRouteProps) {
  const { categoryId } = await params;
  const category = getHelpCategory(categoryId);

  if (!category) {
    notFound();
  }

  let academyName = "your academy";

  try {
    const bootstrap = await loadPublicBootstrap();
    academyName = bootstrap.publicName?.trim() || bootstrap.issuerName?.trim() || academyName;
  } catch {
    // Decorative label only.
  }

  return (
    <PageGate state="ready" title={category.title}>
      <main className="px-1 py-2 sm:py-4">
        <HelpCategoryPage categoryId={categoryId} academyName={academyName} />
      </main>
    </PageGate>
  );
}
