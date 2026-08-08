import { parseStorageEnv, type StorageEnv } from "../schemas/storage-env";
import type { StorageProvider } from "./storage-provider";
import { LocalFilesystemStorageProvider } from "./local-filesystem-storage-provider";
import { LocalMockStorageProvider } from "./local-mock-storage-provider";
import { R2StorageProvider } from "./r2-storage-provider";

let cachedProvider: StorageProvider | null = null;

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
  if (!cachedProvider) {
    cachedProvider = createStorageProvider(parseStorageEnv(process.env));
  }

  return cachedProvider;
}

export function setStorageProviderForTests(provider: StorageProvider | null): void {
  cachedProvider = provider;
}
