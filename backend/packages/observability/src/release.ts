export function readReleaseIdentifier(): string | undefined {
  const version = process.env["RELEASE_VERSION"]?.trim();
  if (version) {
    return version;
  }

  const sha = process.env["RELEASE_SHA"]?.trim();
  if (sha) {
    return sha.slice(0, 12);
  }

  return undefined;
}

export function readDeploymentEnvironment(): string {
  return (
    process.env["RELEASE_ENV"]?.trim() ||
    process.env["APP_ENV"]?.trim() ||
    process.env["NODE_ENV"]?.trim() ||
    "development"
  );
}
