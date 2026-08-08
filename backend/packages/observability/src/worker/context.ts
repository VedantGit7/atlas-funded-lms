import { createRequestId } from "@atlas/core/request/request-id";

export type WorkerObservabilityContext = {
  workerRequestId: string;
  parentRequestId: string;
  jobName: string;
};

export function createWorkerObservabilityContext(args: {
  parentRequestId: string;
  jobName: string;
}): WorkerObservabilityContext {
  return {
    workerRequestId: createRequestId(),
    parentRequestId: args.parentRequestId,
    jobName: args.jobName,
  };
}
