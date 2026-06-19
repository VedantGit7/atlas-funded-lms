"use client";

import { useCallback, useState } from "react";
import type {
  CompetencyDimensionDto,
  ScoringProfileDto,
} from "../../../server/competency/competency-config.types";
import { DimensionEditor } from "./DimensionEditor";
import { ScoringProfileEditor } from "./ScoringProfileEditor";
import { BandThresholdEditor } from "./BandThresholdEditor";
import { ScoringPublishPanel } from "./ScoringPublishPanel";
import { SignalInspectorPlaceholder } from "./SignalInspectorPlaceholder";

type CompetencyConfigPanelProps = {
  initialDimensions: CompetencyDimensionDto[];
  initialProfiles: ScoringProfileDto[];
  canManageDimensions: boolean;
  canCreateProfiles: boolean;
  canUpdateProfiles: boolean;
  canManageBands: boolean;
  canPublish: boolean;
};

export function CompetencyConfigPanel({
  initialDimensions,
  initialProfiles,
  canManageDimensions,
  canCreateProfiles,
  canUpdateProfiles,
  canManageBands,
  canPublish,
}: CompetencyConfigPanelProps) {
  const [dimensions, setDimensions] = useState(initialDimensions);
  const [profiles] = useState(initialProfiles);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    initialProfiles[0]?.id ?? null,
  );

  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <div className="space-y-6">
      <DimensionEditor
        dimensions={dimensions}
        canManage={canManageDimensions}
        onChanged={() => {
          refresh();
          setDimensions(dimensions);
        }}
      />

      <ScoringProfileEditor
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        canCreate={canCreateProfiles}
        canUpdate={canUpdateProfiles}
        onSelectProfile={setSelectedProfileId}
        onChanged={refresh}
      />

      <BandThresholdEditor
        profileId={selectedProfileId}
        canManage={canManageBands}
        onChanged={refresh}
      />

      <ScoringPublishPanel
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        canPublish={canPublish}
        onPublished={refresh}
      />

      <SignalInspectorPlaceholder />
    </div>
  );
}
