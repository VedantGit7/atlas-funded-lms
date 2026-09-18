"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CompetencyDimensionDto,
  ScoringProfileDto,
} from "@atlas/contracts/competency/competency-config.types";
import {
  listCompetencyDimensions,
  listProfileBands,
  listScoringProfiles,
} from "@atlas/contracts-modules/competency/competency-config.api-client";
import { CompetencyPageHeader } from "./CompetencyPageHeader";
import { DimensionEditor } from "./DimensionEditor";
import { ScoringProfileEditor } from "./ScoringProfileEditor";
import { BandThresholdEditor } from "./BandThresholdEditor";
import { ScoringPublishPanel } from "./ScoringPublishPanel";
import { CompetencySignalTable } from "./CompetencySignalTable";

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
  const [profiles, setProfiles] = useState(initialProfiles);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    initialProfiles[0]?.id ?? null,
  );
  const [bandCount, setBandCount] = useState(0);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;

  const refreshBandCount = useCallback(async (profileId: string | null) => {
    if (!profileId) {
      setBandCount(0);
      return;
    }

    try {
      const response = await listProfileBands(profileId);
      setBandCount(response.data.length);
    } catch {
      setBandCount(0);
    }
  }, []);

  const refresh = useCallback(async () => {
    const [nextDimensions, nextProfiles] = await Promise.all([
      listCompetencyDimensions(),
      listScoringProfiles(),
    ]);
    setDimensions(nextDimensions.data);
    setProfiles(nextProfiles.data);
    setSelectedProfileId((current) => {
      const nextId =
        current && nextProfiles.data.some((profile) => profile.id === current)
          ? current
          : (nextProfiles.data[0]?.id ?? null);
      void refreshBandCount(nextId);
      return nextId;
    });
  }, [refreshBandCount]);

  useEffect(() => {
    void refreshBandCount(selectedProfileId);
  }, [selectedProfileId, refreshBandCount]);

  function handleSelectProfile(profileId: string) {
    setSelectedProfileId(profileId);
    void refreshBandCount(profileId);
  }

  return (
    <div className="admin-theme mx-auto max-w-[1200px] space-y-6 text-[var(--admin-on-surface)]">
      <CompetencyPageHeader selectedProfile={selectedProfile} dimensionCount={dimensions.length} />

      <div className="grid grid-cols-12 items-start gap-6">
        <div className="col-span-12 space-y-6 lg:col-span-5">
          <ScoringProfileEditor
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            canCreate={canCreateProfiles}
            canUpdate={canUpdateProfiles}
            onSelectProfile={handleSelectProfile}
            onChanged={() => {
              void refresh();
            }}
          />

          <DimensionEditor
            dimensions={dimensions}
            canManage={canManageDimensions}
            onChanged={() => {
              void refresh();
            }}
          />
        </div>

        <div className="col-span-12 space-y-6 lg:col-span-7">
          <BandThresholdEditor
            profileId={selectedProfileId}
            profileName={selectedProfile?.name ?? null}
            canManage={canManageBands}
            onChanged={() => {
              void refreshBandCount(selectedProfileId);
              void refresh();
            }}
          />

          <ScoringPublishPanel
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            dimensionCount={dimensions.length}
            bandCount={bandCount}
            canPublish={canPublish}
            onPublished={() => {
              void refresh();
            }}
          />
        </div>

        <div className="col-span-12">
          <CompetencySignalTable />
        </div>
      </div>
    </div>
  );
}
