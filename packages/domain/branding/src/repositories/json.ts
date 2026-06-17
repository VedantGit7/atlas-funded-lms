export function toJsonbLiteral(value: unknown): string {
  return JSON.stringify(value ?? null);
}
