export type BrowserServer = { name: string; command: string; url: string };
export type BrowserServerHandle = {
  server: BrowserServer;
  child: import("node:child_process").ChildProcess;
  exited: boolean;
};

export declare function browserServers(env?: NodeJS.ProcessEnv): [BrowserServer, BrowserServer];
export declare function isServerReady(url: string): Promise<boolean>;
export declare function startBrowserServers(
  servers: readonly BrowserServer[],
  options?: { logFile?: string; timeoutMs?: number; pollMs?: number },
): Promise<{ handles: BrowserServerHandle[] }>;
export declare function stopBrowserServers(handles: readonly BrowserServerHandle[]): void;
