export declare function startTestCleanupRun(env?: NodeJS.ProcessEnv): Promise<null | {
  runId: string;
  workerOptions: string;
  cleanup: () => Promise<{
    tenants: number;
    childRows: number;
    principals: number;
    retainedPrincipals: number;
  }>;
}>;
