import { validateDeploymentStartup } from "../backend/packages/api/src/deployment-startup";
import {
  DeploymentConfigurationError,
  type DeploymentService,
} from "../backend/packages/core/src/config/deployment-contract";

const service = process.argv[2] ?? "api";
if (!["api", "web", "worker"].includes(service)) {
  console.error(JSON.stringify({ ok: false, issues: ["Service must be api, web or worker"] }));
  process.exitCode = 1;
} else {
  try {
    const result = validateDeploymentStartup(service as DeploymentService);
    console.log(JSON.stringify({ ok: true, ...result, connectivityVerified: false }));
  } catch (error) {
    // Errors from URL/schema/provider libraries may contain secrets. Only our
    // deliberate, value-free contract errors are safe to print.
    const issues =
      error instanceof DeploymentConfigurationError
        ? error.issues
        : ["Redis or trusted-proxy configuration is invalid"];
    console.error(JSON.stringify({ ok: false, issues, connectivityVerified: false }));
    process.exitCode = 1;
  }
}
