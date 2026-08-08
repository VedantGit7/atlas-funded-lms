import { Suspense } from "react";
import { SignupForm } from "./_components/SignupForm";
import { SignupFormSkeleton } from "./_components/SignupFormSkeleton";

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFormSkeleton />}>
      <SignupForm />
    </Suspense>
  );
}
