export function isPlatformPermission(key: string): boolean {
  return key.startsWith("platform.");
}

export function isWildcardPermission(key: string): boolean {
  return key.includes("*");
}
