import { randomUUID } from "node:crypto";

/** SQL-boundary double for route suites; transaction/concurrency is tested on Postgres. */
export function createPlatformIdempotencyStore() {
  const records = new Map<string, Record<string, unknown>>();
  return {
    clear: () => records.clear(),
    wrap<
      T extends {
        $queryRaw: (...args: never[]) => unknown;
        $executeRaw?: (...args: never[]) => unknown;
      },
    >(base: T) {
      return {
        ...base,
        $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
          const text = sql.join("");
          if (!text.includes("platform_idempotency_records")) {
            return Reflect.apply(base.$queryRaw, base, [sql, ...values]);
          }
          const key = values[0] as string;
          if (text.includes("INSERT INTO")) {
            if (records.has(key)) return [];
            const record = {
              id: randomUUID(),
              actor_principal_id: values[1],
              scope: values[2],
              request_fingerprint: values[4],
              status: "IN_PROGRESS",
              replay_valid: true,
            };
            records.set(key, record);
            return [{ id: record.id }];
          }
          return records.has(key) ? [records.get(key)] : [];
        },
        $executeRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
          if (!sql.join("").includes("platform_idempotency_records")) {
            return base.$executeRaw ? Reflect.apply(base.$executeRaw, base, [sql, ...values]) : 0;
          }
          const row = [...records.values()].find((record) => record.id === values[2]);
          if (!row) throw new Error("Unknown test idempotency claim");
          Object.assign(row, {
            status: "COMPLETED",
            response_json: values[0] ? JSON.parse(values[0] as string) : null,
            response_omitted: values[1],
          });
          return 1;
        },
      };
    },
  };
}
