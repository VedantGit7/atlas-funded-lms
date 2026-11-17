import type { Metadata } from "next";
import { Suspense } from "react";
import { CompleteSignupForm } from "./_components/CompleteSignupForm";

export const metadata: Metadata = {
  title: "Finish creating your account",
  robots: { index: false, follow: false },
};

/** Opened from a sign-up's emailed link; the token is in the query string. */
export default function CompleteSignupPage() {
  return (
    <Suspense fallback={null}>
      <CompleteSignupForm />
    </Suspense>
  );
}
