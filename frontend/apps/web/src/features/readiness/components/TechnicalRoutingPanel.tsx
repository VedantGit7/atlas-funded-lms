"use client";

import type { ScoringProfileDto } from "@atlas/contracts/competency/competency-config.types";
import { AdminSelectDropdown } from "./AdminSelectDropdown";
import {
  fieldClassName,
  joinHttpsUrl,
  labelClassName,
  monoClassName,
  panelBodyClassName,
  panelClassName,
  splitHttpsUrl,
} from "../readiness-admin-shared";

type TechnicalRoutingPanelProps = {
  scoringProfileId: string;
  scoringProfiles: ScoringProfileDto[];
  outboundTargetUrl: string;
  tokenTtlSeconds: number;
  disabled?: boolean;
  onScoringProfileChange: (value: string) => void;
  onTargetUrlChange: (value: string) => void;
  onTokenTtlChange: (value: number) => void;
};

export function TechnicalRoutingPanel({
  scoringProfileId,
  scoringProfiles,
  outboundTargetUrl,
  tokenTtlSeconds,
  disabled,
  onScoringProfileChange,
  onTargetUrlChange,
  onTokenTtlChange,
}: TechnicalRoutingPanelProps) {
  const { hostPath } = splitHttpsUrl(outboundTargetUrl);

  const profileOptions = scoringProfiles.map((profile) => ({
    value: profile.id,
    label: `${profile.name} (${profile.key})`,
  }));

  return (
    <section className={panelClassName} aria-labelledby="technical-routing-heading">
      <div className="border-b border-[var(--admin-border)] px-4 py-3 sm:px-5">
        <h2
          id="technical-routing-heading"
          className="text-base font-semibold text-[var(--admin-on-surface)]"
        >
          Technical Routing
        </h2>
      </div>

      <div className={`${panelBodyClassName} grid grid-cols-1 gap-6 md:grid-cols-2`}>
        <div className="md:col-span-2">
          <AdminSelectDropdown
            id="scoring-profile"
            value={scoringProfileId}
            options={profileOptions}
            disabled={disabled ?? false}
            label="Scoring profile"
            ariaLabel="Scoring profile"
            onChange={onScoringProfileChange}
          />
          <p className={`${monoClassName} mt-1.5`}>
            Readiness composites are derived from this profile&apos;s published bands.
          </p>
        </div>

        <div>
          <label className={labelClassName} htmlFor="redirect-host-path">
            Target redirect URL
          </label>
          <div className="mt-1.5 flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-3 text-sm text-[var(--admin-on-surface-variant)]">
              https://
            </span>
            <input
              id="redirect-host-path"
              className={`${fieldClassName} rounded-l-none`}
              value={hostPath}
              disabled={disabled}
              placeholder="academy.example.com/readiness"
              onChange={(event) => {
                onTargetUrlChange(joinHttpsUrl(event.target.value));
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] italic text-[var(--admin-on-surface-variant)]">
            Must be an HTTPS URL on a verified academy subdomain.
          </p>
        </div>

        <div>
          <label className={labelClassName} htmlFor="token-ttl">
            Token TTL (seconds)
          </label>
          <input
            id="token-ttl"
            className={`${fieldClassName} mt-1.5`}
            type="number"
            min={60}
            max={86400}
            value={tokenTtlSeconds}
            disabled={disabled}
            onChange={(event) => {
              onTokenTtlChange(Number(event.target.value));
            }}
          />
          <p className="mt-1.5 text-[11px] text-[var(--admin-on-surface-variant)]">
            Standard expiration is 1 hour (3600s).
          </p>
        </div>
      </div>
    </section>
  );
}
