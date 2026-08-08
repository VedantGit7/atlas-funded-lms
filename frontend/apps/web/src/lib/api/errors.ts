export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

export class ClientApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(code: string, status: number, requestId: string, message: string) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export class ServerApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(code: string, status: number, requestId: string, message: string) {
    super(message);
    this.name = "ServerApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}
