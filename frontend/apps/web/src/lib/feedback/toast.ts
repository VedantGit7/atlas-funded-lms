import { pushToast } from "./toast-store";
import type { MutationHttpMethod } from "./toast-messages";
import { resolveMutationSuccessToast } from "./toast-messages";

export const toast = {
  success(message: string) {
    pushToast(message, "success");
  },

  error(message: string) {
    pushToast(message, "error");
  },

  mutationSuccess(args: {
    idempotencyKeyPrefix: string;
    method: MutationHttpMethod;
    message?: string;
    silent?: boolean;
  }) {
    if (args.silent) return;
    const message = resolveMutationSuccessToast(args.idempotencyKeyPrefix, args.method, args.message);
    if (message) {
      pushToast(message, "success");
    }
  },
};

export type { MutationHttpMethod };
