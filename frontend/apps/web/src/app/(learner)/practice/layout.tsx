import { LearnerShell } from "../../../components/shells/LearnerShell";

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return <LearnerShell>{children}</LearnerShell>;
}
