import { parseStorageEnv, type StorageEnv } from "../schemas/storage-env";
import type { StorageProvider } from "./storage-provider";
import { LocalFilesystemStorageProvider } from "./local-filesystem-storage-provider";
import { LocalMockStorageProvider } from "./local-mock-storage-provider";
import { R2StorageProvider } from "./r2-storage-provider";
import { isDeployedRuntime } from "@atlas/core/config/runtime-environment";

let cachedProvider: StorageProvider | null = null;
let cachedForDeployment = false;

export function createStorageProvider(env: StorageEnv): StorageProvider {
  if (env.STORAGE_PROVIDER === "r2") {
    return new R2StorageProvider(env);
  }

  if (env.STORAGE_PROVIDER === "local-fs") {
    return new LocalFilesystemStorageProvider(env);
  }

  return new LocalMockStorageProvider();
}

export function getStorageProvider(): StorageProvider {
  const env = parseStorageEnv(process.env);
  const deployed = isDeployedRuntime();
  if (deployed && !cachedForDeployment) cachedProvider = null;
  if (!cachedProvider) {
    cachedProvider = createStorageProvider(env);
    cachedForDeployment = deployed;
  }

  return cachedProvider;
}

export function setStorageProviderForTests(provider: StorageProvider | null): void {
  cachedProvider = provider;
  cachedForDeployment = false;
}
