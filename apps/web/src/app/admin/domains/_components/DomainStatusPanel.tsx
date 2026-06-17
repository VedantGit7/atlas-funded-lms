"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import type { TenantDomainViewSchema } from "@atlas/domain-branding/schemas/domains";
import { ClientApiError, clientApi } from "../../../../lib/client-api";

type TenantDomain = z.infer<typeof TenantDomainViewSchema>;

type DomainStatusPanelProps = {
  domains: TenantDomain[];
};

export function DomainStatusPanel({ domains }: DomainStatusPanelProps) {
  const router = useRouter();
  const [busyDomainId, setBusyDomainId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function disableDomain(domain: TenantDomain) {
    if (domain.type === "ATLAS_SUBDOMAIN") {
      setErrorMessage("Atlas fallback subdomains cannot be removed.");
      return;
    }

    if (!window.confirm(`Disable domain ${domain.hostname}?`)) {
      return;
    }

    setBusyDomainId(domain.id);
    setErrorMessage(null);

    try {
      await clientApi.delete(`/api/v1/domains/${domain.id}`, "domain-delete");
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyDomainId(null);
    }
  }

  if (domains.length === 0) {
    return <p>No domains configured for this tenant.</p>;
  }

  return (
    <section aria-label="Domain status">
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <table>
        <thead>
          <tr>
            <th scope="col">Hostname</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col">Primary</th>
            <th scope="col">Verification</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((domain) => (
            <tr key={domain.id}>
              <td>{domain.hostname}</td>
              <td>{domain.type}</td>
              <td>{domain.status}</td>
              <td>{domain.isPrimary ? "Yes" : "No"}</td>
              <td>
                {domain.status === "PENDING" &&
                domain.verificationTxtName &&
                domain.verificationTxtValue ? (
                  <div>
                    <p>Add TXT record:</p>
                    <code>
                      {domain.verificationTxtName} = {domain.verificationTxtValue}
                    </code>
                  </div>
                ) : (
                  "—"
                )}
              </td>
              <td>
                {domain.type === "CUSTOM_DOMAIN" ? (
                  <button
                    type="button"
                    onClick={() => {
                      void disableDomain(domain);
                    }}
                    disabled={busyDomainId === domain.id}
                  >
                    {busyDomainId === domain.id ? "Disabling…" : "Disable"}
                  </button>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return `${error.message} (${error.code})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}
