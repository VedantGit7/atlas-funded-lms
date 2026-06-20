import type { z } from "zod";
import type { publicVerifyResponseSchema } from "../../../server/certificates/certificate.dto";

type PublicVerifyData = z.infer<typeof publicVerifyResponseSchema>["data"];

type VerificationCardProps = {
  data: PublicVerifyData;
  issuerName?: string | null;
};

export function VerificationCard({ data, issuerName }: VerificationCardProps) {
  const displayIssuer = data.issuer.displayName ?? issuerName ?? "Issuer";

  return (
    <article className="mx-auto max-w-xl rounded-xl border border-neutral-200 bg-white p-8 shadow-sm print:shadow-none">
      <header className="mb-6 border-b border-neutral-200 pb-4">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Credential verification</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{displayIssuer}</h1>
      </header>
      <dl className="grid gap-4 text-sm">
        <div>
          <dt className="font-medium text-neutral-600">Status</dt>
          <dd className="text-lg capitalize text-neutral-900">{data.status}</dd>
        </div>
        <div>
          <dt className="font-medium text-neutral-600">Credential ID</dt>
          <dd className="font-mono text-neutral-900">{data.credentialId}</dd>
        </div>
        <div>
          <dt className="font-medium text-neutral-600">Issued</dt>
          <dd>{new Date(data.issuedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="font-medium text-neutral-600">Verified</dt>
          <dd>{new Date(data.verifiedAt).toLocaleString()}</dd>
        </div>
      </dl>
    </article>
  );
}

export function VerificationNotFound() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-neutral-900">Credential not found</h1>
      <p className="mt-2 text-sm text-neutral-600">
        This credential could not be verified for the current site. Check the link or contact the
        issuer.
      </p>
    </div>
  );
}
