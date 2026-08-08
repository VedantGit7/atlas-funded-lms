import { redirect } from "next/navigation";

/** Legacy route — review now lives inside the admin shell. */
export default function ReviewApprovalsRedirectPage() {
  redirect("/admin/review");
}
