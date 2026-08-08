import { redirect } from "next/navigation";

/** The practice route moved from /swipe to /practice; keep old links working. */
export default function SwipeRedirectPage() {
  redirect("/practice");
}
