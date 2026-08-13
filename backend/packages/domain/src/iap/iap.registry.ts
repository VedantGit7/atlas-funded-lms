import type { IapPlatform, IapVerifier } from "./iap-provider";
import { appleIapAdapter } from "./adapters/apple-iap.adapter";
import { googlePlayAdapter } from "./adapters/google-play.adapter";

const DEFAULT_REGISTRY: Record<IapPlatform, IapVerifier> = {
  ios: appleIapAdapter,
  android: googlePlayAdapter,
};

let registryOverride: Partial<Record<IapPlatform, IapVerifier>> | null = null;

export function getIapVerifier(platform: IapPlatform): IapVerifier {
  return registryOverride?.[platform] ?? DEFAULT_REGISTRY[platform];
}

/** Test helper — restore with `null`. */
export function setIapVerifierOverride(
  override: Partial<Record<IapPlatform, IapVerifier>> | null,
): void {
  registryOverride = override;
}
