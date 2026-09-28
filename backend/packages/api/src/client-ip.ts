import { isDeployedRuntime } from "@atlas/core/config/runtime-environment";
import {
  ATLAS_CLIENT_IP_HEADER,
  normalizeClientIp,
  resolveEdgeClientIp,
} from "@atlas/core/http/api-proxy";

export { validateClientIpConfiguration } from "@atlas/core/http/api-proxy";

/** Internal client IP is overwritten by web/API ingress before route execution. */
export function resolveClientIp(req: Request, env: NodeJS.ProcessEnv = process.env): string {
  const internal = req.headers.get(ATLAS_CLIENT_IP_HEADER);
  if (internal !== null) return normalizeClientIp(internal);
  // Local direct route tests/dev may explicitly simulate an edge. Deployed
  // handlers never infer trust from a caller's raw forwarding headers.
  return isDeployedRuntime(env) ? "unknown" : resolveEdgeClientIp(req.headers, env);
}
