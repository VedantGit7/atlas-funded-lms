"use client";

import { Award, Ban, ExternalLink, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CertificateSelectField } from "./CertificateSelectField";
import {
  avatarInitials,
  CertificateRowSkeleton,
  CertificateStatusPill,
  dangerIconButtonClassName,
  fieldClassName,
  iconButtonClassName,
  primaryButtonClassName,
  type CertificateDto,
  type CertificateStatus,
} from "./certificate-template-admin-shared";

type IssuedCertificateTableProps = {
  certificates: CertificateDto[];
  loading: boolean;
  selectedId: string | null;
  onIssue: () => void;
  onRevoke: (certificate: CertificateDto) => void;
  onSelect: (certificate: CertificateDto) => void;
};

const STATUS_FILTERS: Array<{ value: CertificateStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "issued", label: "Issued" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
  { value: "suspended", label: "Suspended" },
];

export function IssuedCertificateTable({
  certificates,
  loading,
  selectedId,
  onIssue,
  onRevoke,
  onSelect,
}: IssuedCertificateTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CertificateStatus | "all">("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return certificates.filter((certificate) => {
      if (statusFilter !== "all" && certificate.status !== statusFilter) return false;
      if (!query) return true;
      const recipient = (certificate.recipientLabel ?? certificate.membershipId).toLowerCase();
      return (
        recipient.includes(query) ||
        certificate.credentialId.toLowerCase().includes(query) ||
        certificate.templateName.toLowerCase().includes(query)
      );
    });
  }, [certificates, search, statusFilter]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search by recipient, credential ID, or template..."
            className={`${fieldClassName} h-10 pl-10`}
          />
        </div>
        <div className="flex items-center gap-2">
          <CertificateSelectField
            label="Filter by status"
            hideLabel
            className="w-44"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value as CertificateStatus | "all");
            }}
            options={STATUS_FILTERS}
          />
          <button type="button" className={primaryButtonClassName} onClick={onIssue}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Issue certificate
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Credential
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Template
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Recipient
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Status
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Issued
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                <CertificateRowSkeleton />
                <CertificateRowSkeleton />
                <CertificateRowSkeleton />
              </>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-surface-variant)]">
                      <Award
                        className="h-6 w-6 text-[var(--admin-on-surface-variant)]"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      {certificates.length === 0
                        ? "No certificates issued yet"
                        : "No certificates match this filter"}
                    </p>
                    <p className="max-w-sm text-xs text-[var(--admin-on-surface-variant)]">
                      {certificates.length === 0
                        ? "Award your first credential by choosing a published template and a recipient."
                        : "Try a different search term or clear the status filter."}
                    </p>
                    {certificates.length === 0 ? (
                      <button
                        type="button"
                        className={`${primaryButtonClassName} mt-2`}
                        onClick={onIssue}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Issue your first certificate
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((certificate) => {
                const recipient = certificate.recipientLabel ?? certificate.membershipId;
                const isSelected = certificate.id === selectedId;
                return (
                  <tr
                    key={certificate.id}
                    onClick={() => {
                      onSelect(certificate);
                    }}
                    className={`cursor-pointer border-b border-[var(--admin-border)] transition-colors last:border-0 ${
                      isSelected
                        ? "bg-[var(--admin-primary-container)]/40"
                        : "hover:bg-[var(--admin-surface-low)]"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[var(--admin-primary)]">
                        {certificate.credentialId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--admin-on-surface)]">
                      {certificate.templateName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-variant)] text-[10px] font-bold text-[var(--admin-on-surface)]">
                          {avatarInitials(recipient)}
                        </div>
                        <span className="truncate text-sm text-[var(--admin-on-surface)]">
                          {recipient}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <CertificateStatusPill status={certificate.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                      {new Date(certificate.issuedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={certificate.verificationUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                          className={iconButtonClassName}
                          title="Open public verification page"
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </a>
                        {certificate.status === "issued" ? (
                          <button
                            type="button"
                            className={dangerIconButtonClassName}
                            title="Revoke"
                            onClick={(event) => {
                              event.stopPropagation();
                              onRevoke(certificate);
                            }}
                          >
                            <Ban className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
