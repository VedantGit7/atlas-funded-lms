import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildLoginRedirectUrl } from "../auth/auth-navigation";

export async function redirectUnauthenticatedToLogin(fallbackPath: string): Promise<never> {
  const headerList = await headers();
  const pathname = headerList.get("x-atlas-pathname") ?? fallbackPath;
  redirect(buildLoginRedirectUrl(pathname));
}
