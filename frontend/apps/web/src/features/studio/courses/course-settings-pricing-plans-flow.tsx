"use client";

import { useState } from "react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { ChoosePricingPlanDialog } from "./choose-pricing-plan-dialog";
import type { CourseSettingsCard } from "./course-settings-metadata";
import { CourseEditPricingPlanScreen } from "./course-edit-pricing-plan-screen";
import { CourseSettingsDetailShell } from "./course-settings-detail-shell";
import { CourseSettingsPricingPlansPanel } from "./course-settings-pricing-plans-panel";
import type { CoursePricingPlanKind } from "./course-pricing-plan-settings";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type PricingPlanView = "list" | "form";

type CourseSettingsPricingPlansFlowProps = {
  course: CourseDetail;
  editable: boolean;
  section: CourseSettingsCard;
  onCourseChange: (course: CourseDetail) => void;
};

export function CourseSettingsPricingPlansFlow({
  course,
  editable,
  section,
  onCourseChange,
}: CourseSettingsPricingPlansFlowProps) {
  const [planView, setPlanView] = useState<PricingPlanView>("list");
  const [chooserOpen, setChooserOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [selectedPlanKind, setSelectedPlanKind] = useState<CoursePricingPlanKind | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const disabled = !editable;

  if (planView === "form") {
    return (
      <CourseEditPricingPlanScreen
        key={editingPlanId ?? selectedPlanKind ?? "new"}
        course={course}
        planId={editingPlanId}
        planKind={selectedPlanKind}
        disabled={disabled}
        onBack={() => {
          setPlanView("list");
          setEditingPlanId(null);
          setSelectedPlanKind(null);
        }}
        onSaved={(updated) => {
          onCourseChange(updated);
          setRefreshToken((value) => value + 1);
          setPlanView("list");
          setEditingPlanId(null);
          setSelectedPlanKind(null);
        }}
      />
    );
  }

  return (
    <>
      <CourseSettingsDetailShell card={section} courseId={course.id} wide>
        <CourseSettingsPricingPlansPanel
          course={course}
          disabled={disabled}
          refreshToken={refreshToken}
          onAddPlan={() => {
            setChooserOpen(true);
          }}
          onEditPlan={(planId) => {
            setEditingPlanId(planId);
            setSelectedPlanKind(null);
            setPlanView("form");
          }}
          onCourseChange={(updated) => {
            onCourseChange(updated);
            setRefreshToken((value) => value + 1);
          }}
        />
      </CourseSettingsDetailShell>

      <ChoosePricingPlanDialog
        open={chooserOpen}
        disabled={disabled}
        onClose={() => {
          setChooserOpen(false);
        }}
        onSelect={(kind) => {
          setSelectedPlanKind(kind);
          setEditingPlanId(null);
          setChooserOpen(false);
          setPlanView("form");
        }}
      />
    </>
  );
}
