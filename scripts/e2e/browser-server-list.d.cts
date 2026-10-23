export type BrowserServer = {
  name: string;
  command: string;
  url: string;
  env: { NODE_OPTIONS: string };
};

export declare function browserServerEnv(env?: NodeJS.ProcessEnv): { NODE_OPTIONS: string };
export declare function browserServers(env?: NodeJS.ProcessEnv): [BrowserServer, BrowserServer];
