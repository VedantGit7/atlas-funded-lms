import { pingWorkerHeartbeat } from "../better-stack/heartbeat";
import { structuredLogger } from "../logger";
import { runWithObservabilityContext } from "../request-context";
import { captureUnexpectedError } from "../sentry/capture";
import { createWorkerObservabilityContext } from "./context";

export async function runWorkerOutboxBatch<T>(args: {
  parentRequestId: string;
  jobName: string;
  execute: () => Promise<T>;
}): Promise<T> {
  const ctx = createWorkerObservabilityContext({
    parentRequestId: args.parentRequestId,
    jobName: args.jobName,
  });

  await pingWorkerHeartbeat();

  structuredLogger.info({
    message: "worker.cycle.start",
    requestId: ctx.workerRequestId,
    parentRequestId: ctx.parentRequestId,
    jobName: ctx.jobName,
    module: "worker",
  });

  try {
    const result = await runWithObservabilityContext(
      {
        requestId: ctx.workerRequestId,
        parentRequestId: ctx.parentRequestId,
        jobName: ctx.jobName,
      },
      args.execute,
    );

    structuredLogger.info({
      message: "worker.cycle.complete",
      requestId: ctx.workerRequestId,
      parentRequestId: ctx.parentRequestId,
      jobName: ctx.jobName,
      module: "worker",
    });

    return result;
  } catch (error) {
    structuredLogger.error({
      message: "worker.cycle.failure",
      requestId: ctx.workerRequestId,
      parentRequestId: ctx.parentRequestId,
      jobName: ctx.jobName,
      module: "worker",
    });

    captureUnexpectedError(error, {
      requestId: ctx.workerRequestId,
      parentRequestId: ctx.parentRequestId,
      jobName: ctx.jobName,
      module: "worker",
    });

    throw error;
  }
}
