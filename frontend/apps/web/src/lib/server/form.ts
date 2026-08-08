export function readFormString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}
