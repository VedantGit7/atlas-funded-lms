export class SearchValidationError extends Error {
  readonly code = "VALIDATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "SearchValidationError";
  }
}

export function invalidSearchQuery(message: string): SearchValidationError {
  return new SearchValidationError(message);
}

export function unknownSearchSourceType(sourceType: string): SearchValidationError {
  return new SearchValidationError(`Unknown search source type: ${sourceType}`);
}
