"use client";

import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Plus,
  Route,
  Sparkles,
  Users,
} from "lucide-react";
import type { StarterTemplate } from "./starter-templates";

export function StudioPaperPreview({ kind }: { kind: StarterTemplate["previewKind"] }) {
  switch (kind) {
    case "blank":
      return (
        <div className="cert-home__preview cert-home__preview--blank">
          <Plus className="cert-home__preview-add" size={36} strokeWidth={1.25} aria-hidden />
        </div>
      );
    case "achievement":
      return (
        <div className="cert-home__preview cert-home__preview--achievement">
          <div className="cert-home__preview-eyebrow">Certificate of Achievement</div>
          <div className="cert-home__preview-rule" />
          <div className="cert-home__preview-italic">This is to certify that...</div>
        </div>
      );
    case "mastery":
      return (
        <div className="cert-home__preview cert-home__preview--mastery">
          <div className="cert-home__preview-seal">
            <GraduationCap size={22} strokeWidth={1.5} aria-hidden />
          </div>
          <div className="cert-home__preview-display">Mastery</div>
        </div>
      );
    case "legacy":
      return (
        <div className="cert-home__preview cert-home__preview--legacy">
          <div className="cert-home__preview-year">2026</div>
          <div className="cert-home__preview-legacy-title">Legacy Excellence</div>
          <div className="cert-home__preview-dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
        </div>
      );
    case "corporate":
      return (
        <div className="cert-home__preview cert-home__preview--corporate">
          <div className="cert-home__preview-texture" />
          <div className="cert-home__preview-corp-label">Corporate Standard</div>
        </div>
      );
    case "honorable":
      return (
        <div className="cert-home__preview cert-home__preview--honorable">
          <div className="cert-home__preview-double">
            <span>Honorable</span>
          </div>
        </div>
      );
    case "gold":
      return (
        <div className="cert-home__preview cert-home__preview--gold" style={{ padding: "2rem" }}>
          <div className="cert-home__preview-dashed" />
        </div>
      );
    case "modern":
      return (
        <div className="cert-home__preview cert-home__preview--modern">
          <div className="cert-home__preview-skel-bar" />
          <div className="cert-home__preview-skel-bar" />
        </div>
      );
    case "branded":
      return (
        <div className="cert-home__preview cert-home__preview--branded">
          <div className="cert-home__preview-brand-mark" />
          <div
            className="cert-home__preview-display"
            style={{ fontSize: 10, letterSpacing: "0.12em" }}
          >
            Your academy
          </div>
        </div>
      );
    case "completion":
      return (
        <div className="cert-home__preview cert-home__preview--completion">
          <div className="cert-home__preview-teal-bar" aria-hidden />
          <CheckCircle2 size={20} strokeWidth={1.5} aria-hidden />
          <div className="cert-home__preview-display" style={{ fontSize: 9 }}>
            Completion
          </div>
        </div>
      );
    case "participation":
      return (
        <div className="cert-home__preview cert-home__preview--participation">
          <Users size={20} strokeWidth={1.5} aria-hidden />
          <div className="cert-home__preview-display" style={{ fontSize: 9 }}>
            Participation
          </div>
        </div>
      );
    case "excellence":
      return (
        <div className="cert-home__preview cert-home__preview--excellence">
          <Award size={20} strokeWidth={1.5} aria-hidden />
          <div className="cert-home__preview-display" style={{ fontSize: 9 }}>
            Excellence
          </div>
        </div>
      );
    case "recognition":
      return (
        <div className="cert-home__preview cert-home__preview--recognition">
          <Sparkles size={18} strokeWidth={1.5} aria-hidden />
          <div className="cert-home__preview-display" style={{ fontSize: 9 }}>
            Recognition
          </div>
        </div>
      );
    case "assessment":
      return (
        <div className="cert-home__preview cert-home__preview--assessment">
          <ClipboardCheck size={20} strokeWidth={1.5} aria-hidden />
          <div className="cert-home__preview-display" style={{ fontSize: 9 }}>
            Assessment
          </div>
        </div>
      );
    case "path":
      return (
        <div className="cert-home__preview cert-home__preview--path">
          <Route size={18} strokeWidth={1.5} aria-hidden />
          <div className="cert-home__preview-path-steps" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div className="cert-home__preview-display" style={{ fontSize: 9 }}>
            Learning path
          </div>
        </div>
      );
    case "classic":
    default:
      return (
        <div className="cert-home__preview cert-home__preview--classic">
          <div className="cert-home__preview-classic-frame">Sales Excellence</div>
        </div>
      );
  }
}
