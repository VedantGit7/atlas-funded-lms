"use client";

import type { AdminManageSlug } from "./admin-manage-catalog";
import { getAdminManageSection } from "./admin-manage-catalog";
import { ManageCourseEncryptionPanel } from "./ManageCourseEncryptionPanel";
import { ManageDiscussionsPanel } from "./ManageDiscussionsPanel";
import { ManageRatingsReviewsPanel } from "./ManageRatingsReviewsPanel";
import { ManageAnswerReviewsPanel } from "./ManageAnswerReviewsPanel";
import { ManageLearnerSupportPanel } from "./ManageLearnerSupportPanel";
import { ManageArchiveLearnersPanel } from "./ManageArchiveLearnersPanel";
import { AdminLearnerProductsPage } from "../learner-products/AdminLearnerProductsPage";
import { AdminTagsPage } from "../tags/AdminTagsPage";
import { ManageCourseBackupPanel } from "./ManageCourseBackupPanel";
import { ManageSectionTabs } from "./ManageSectionTabs";
import { managePageDescClassName, managePageTitleClassName } from "./manage-ui-shared";

type AdminManageSectionPageProps = {
  slug: AdminManageSlug;
};

export function AdminManageSectionPage({ slug }: AdminManageSectionPageProps) {
  const section = getAdminManageSection(slug);
  if (!section) return null;

  return (
    <div className="space-y-6">
      <ManageSectionTabs active={slug} />

      <header>
        <h1 className={managePageTitleClassName}>{section.title}</h1>
        <p className={managePageDescClassName}>{section.description}</p>
      </header>

      <ManageSectionBody slug={slug} />
    </div>
  );
}

function ManageSectionBody({ slug }: { slug: AdminManageSlug }) {
  switch (slug) {
    case "course-encryption":
      return <ManageCourseEncryptionPanel />;
    case "discussions":
      return <ManageDiscussionsPanel />;
    case "ratings-and-reviews":
      return <ManageRatingsReviewsPanel />;
    case "answer-reviews":
      return <ManageAnswerReviewsPanel />;
    case "learner-support":
      return <ManageLearnerSupportPanel />;
    case "archive-learners":
      return <ManageArchiveLearnersPanel />;
    case "course-backup":
      return <ManageCourseBackupPanel />;
    case "learner-products":
      return <AdminLearnerProductsPage />;
    case "tags":
      return <AdminTagsPage />;
    default:
      return null;
  }
}
