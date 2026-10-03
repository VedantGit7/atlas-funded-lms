import { headers } from "next/headers";
import { ATLAS_CLIENT_IP_HEADER, normalizeClientIp } from "@atlas/core/http/api-proxy";

/** Read only web-proxy-stamped context, never reinterpret the raw edge chain. */
export async function resolveClientIpForInternalApi(): Promise<string> {
  return normalizeClientIp((await headers()).get(ATLAS_CLIENT_IP_HEADER) ?? "");
}
