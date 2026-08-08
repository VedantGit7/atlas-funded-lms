import { redactObject } from "./redaction";
import { getObservabilityRequestContext } from "./request-context";
import { readDeploymentEnvironment, readReleaseIdentifier } from "./release";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type StructuredLogFields = {
  message: string;
  level?: LogLevel;
  requestId?: string;
  parentRequestId?: string;
  environment?: string;
  release?: string;
  route?: string;
  jobName?: string;
  durationMs?: number;
  statusCode?: number;
  errorCode?: string;
  tenantSafeId?: string;
  actorSafeId?: string;
  eventType?: string;
  module?: string;
  [key: string]: unknown;
};

function isDebugEnabled(): boolean {
  return process.env["OBSERVABILITY_DEBUG"] === "true";
}

function buildLogRecord(fields: StructuredLogFields): Record<string, unknown> {
  const context = getObservabilityRequestContext();

  const record: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level: fields.level ?? "info",
    message: fields.message,
    requestId: fields.requestId ?? context?.requestId,
    environment: fields.environment ?? readDeploymentEnvironment(),
    release: fields.release ?? readReleaseIdentifier(),
    route: fields.route ?? context?.route,
    jobName: fields.jobName ?? context?.jobName,
    durationMs: fields.durationMs,
    statusCode: fields.statusCode,
    errorCode: fields.errorCode,
    tenantSafeId: fields.tenantSafeId ?? context?.tenantSafeId,
    actorSafeId: fields.actorSafeId ?? context?.actorSafeId,
    eventType: fields.eventType ?? context?.eventType,
    parentRequestId: fields.parentRequestId ?? context?.parentRequestId,
    module: fields.module,
  };

  for (const [key, value] of Object.entries(fields)) {
    if (key === "message" || key === "level" || key in record || value === undefined) {
      continue;
    }

    record[key] = value;
  }

  return redactObject(record);
}

function writeLog(level: LogLevel, fields: StructuredLogFields): void {
  if (level === "debug" && !isDebugEnabled()) {
    return;
  }

  const record = buildLogRecord({ ...fields, level });
  const line = JSON.stringify(record);

  if (level === "error") {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

export const structuredLogger = {
  debug(fields: StructuredLogFields): void {
    writeLog("debug", fields);
  },
  info(fields: StructuredLogFields): void {
    writeLog("info", fields);
  },
  warn(fields: StructuredLogFields): void {
    writeLog("warn", fields);
  },
  error(fields: StructuredLogFields): void {
    writeLog("error", fields);
  },
};
