import { Suspense } from "react";
import { SignupForm } from "./_components/SignupForm";

export default function SignupPage() {
  return (
    <Suspense fallback={<p>Loading signup form...</p>}>
      <SignupForm />
    </Suspense>
  );
}
