/**
 * Types for configs/security-headers.mjs.
 *
 * The implementation stays plain ESM so both Next apps can import it from
 * outside their own tsconfig project graphs; this declaration gives `tsc -b`
 * the shape without pulling the file into either project's `include`.
 */

export type SecurityHeader = {
  key: string;
  value: string;
};

export declare const securityHeaders: SecurityHeader[];

export declare const securityHeadersRule: {
  source: string;
  headers: SecurityHeader[];
};
