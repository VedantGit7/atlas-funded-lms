import { Award } from "lucide-react";

type CertificateLivePreviewProps = {
  headline: string;
  subheadline: string;
  bodyLines: string[];
  accentColor: string;
};

export function CertificateLivePreview({
  headline,
  subheadline,
  bodyLines,
  accentColor,
}: CertificateLivePreviewProps) {
  return (
    <div
      className="relative flex aspect-[1.414/1] w-full flex-col items-center justify-center overflow-hidden rounded-lg p-8 text-center shadow-inner"
      style={{
        backgroundColor: "var(--admin-certificate-paper)",
        color: "var(--admin-certificate-ink)",
        border: `10px solid ${accentColor}`,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-3 h-10 w-10 opacity-25"
        style={{
          backgroundImage: `radial-gradient(circle, ${accentColor} 1px, transparent 1px)`,
          backgroundSize: "7px 7px",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-3 right-3 h-10 w-10 opacity-25"
        style={{
          backgroundImage: `radial-gradient(circle, ${accentColor} 1px, transparent 1px)`,
          backgroundSize: "7px 7px",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-14 -left-14 h-40 w-40 rounded-full"
        style={{ border: `1px solid color-mix(in srgb, ${accentColor} 30%, transparent)` }}
      />

      <div className="relative z-10 space-y-4">
        <p className="font-ceremonial text-sm italic tracking-wide opacity-70">
          Certificate of Completion
        </p>
        <div className="mx-auto h-px w-16" style={{ backgroundColor: accentColor }} />
        <h5 className="font-ceremonial text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl">
          {headline.trim() || "Untitled certificate"}
        </h5>
        {subheadline.trim() ? (
          <p className="mx-auto max-w-[30ch] text-sm leading-relaxed opacity-80">{subheadline}</p>
        ) : null}
        {bodyLines.length > 0 ? (
          <div className="space-y-1 pt-1 text-xs leading-relaxed opacity-70">
            {bodyLines.map((line, index) => (
              <p key={`${index.toString()}-${line}`}>{line}</p>
            ))}
          </div>
        ) : null}
        <div className="pt-2">
          <div
            className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2"
            style={{ borderColor: `color-mix(in srgb, ${accentColor} 40%, transparent)` }}
          >
            <Award className="h-5 w-5" style={{ color: accentColor }} aria-hidden="true" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-50">
            Verified academic registry
          </p>
        </div>
      </div>
    </div>
  );
}
