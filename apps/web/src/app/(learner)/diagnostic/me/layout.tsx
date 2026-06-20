import { LearnerShell } from "../../../../components/shells/LearnerShell";

type LearnerDiagnosticLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function LearnerDiagnosticLayout({ children }: LearnerDiagnosticLayoutProps) {
  return <LearnerShell>{children}</LearnerShell>;
}
