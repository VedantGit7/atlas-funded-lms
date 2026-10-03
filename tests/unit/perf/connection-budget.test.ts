import { describe, expect, it } from "vitest";
// @ts-expect-error JavaScript measurement utility.
import { validateConnectionBudget } from "../../../scripts/perf/connection-budget.mjs";

const valid = () => ({
  databaseMaxConnections: 100,
  reservedConnections: 10,
  processes: {
    web: { instances: 2, tenantPoolMax: 20, platformPoolMax: 10, usagePoolMax: 2 },
    api: { instances: 1, tenantPoolMax: 10, platformPoolMax: 5, usagePoolMax: 2 },
    worker: { instances: 1, tenantPoolMax: 5, platformPoolMax: 2, usagePoolMax: 2 },
  },
});

describe("cross-process database connection budget", () => {
  it("includes every instance, all three pools, and operational reserves", () => {
    expect(validateConnectionBudget(valid())).toEqual({
      databaseMaxConnections: 100,
      reservedConnections: 10,
      applicationConnections: 90,
      totalConnections: 100,
      headroom: 0,
      processes: { web: 64, api: 17, worker: 9 },
    });
  });

  it("allows exactly the limit and rejects even one connection above it", () => {
    const config = valid();
    config.databaseMaxConnections = 100;
    expect(validateConnectionBudget(config).headroom).toBe(0);
    config.databaseMaxConnections = 99;
    expect(() => validateConnectionBudget(config)).toThrow(/exceeds/);
  });

  it.each([undefined, null, {}, { databaseMaxConnections: 100 }])(
    "rejects incomplete configuration: %j",
    (config) => {
      expect(() => validateConnectionBudget(config)).toThrow();
    },
  );

  it.each([-1, 1.5, "2", null, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid instance count %s",
    (instances) => {
      const config = valid();
      Object.assign(config.processes.web, { instances });
      expect(() => validateConnectionBudget(config)).toThrow();
    },
  );

  it("requires explicit pool sizes even for a zero-instance process", () => {
    const config = valid();
    Object.assign(config.processes.worker, { instances: 0, platformPoolMax: undefined });
    expect(() => validateConnectionBudget(config)).toThrow();
  });

  it("allows explicit zero pools and process counts but no zero database limit", () => {
    const config = valid();
    config.processes.worker = {
      instances: 0,
      tenantPoolMax: 0,
      platformPoolMax: 0,
      usagePoolMax: 0,
    };
    expect(validateConnectionBudget(config).applicationConnections).toBe(81);
    config.databaseMaxConnections = 0;
    expect(() => validateConnectionBudget(config)).toThrow();
  });

  it("rejects zero pools on active processes because runtime replaces them with defaults", () => {
    const config = valid();
    config.processes.web.tenantPoolMax = 0;
    expect(() => validateConnectionBudget(config)).toThrow();
    config.processes.web.tenantPoolMax = 20;
    config.processes.web.platformPoolMax = 0;
    expect(() => validateConnectionBudget(config)).toThrow();
    config.processes.web.platformPoolMax = 10;
    config.processes.web.usagePoolMax = 0;
    expect(() => validateConnectionBudget(config)).toThrow();
  });

  it.each([0, 1])("requires explicit usage capacity even with %s instances", (instances) => {
    const config = valid();
    config.processes.worker.instances = instances;
    const { usagePoolMax: _usage, ...oldShape } = config.processes.worker;
    Object.assign(config.processes, { worker: oldShape });
    expect(() => validateConnectionBudget(config)).toThrow(/usagePoolMax/);
  });

  it("rejects unknown fields and overflow instead of silently omitting capacity", () => {
    expect(() => validateConnectionBudget({ ...valid(), replicas: 10 })).toThrow();
    const config = valid();
    Object.assign(config.processes, {
      cron: { instances: 10, tenantPoolMax: 20, platformPoolMax: 10 },
    });
    expect(() => validateConnectionBudget(config)).toThrow();
    const overflow = valid();
    overflow.processes.web.instances = Number.MAX_SAFE_INTEGER;
    expect(() => validateConnectionBudget(overflow)).toThrow();
  });
});
