import type { Result, CommandError } from "@/bindings";

/**
 * Unwrap a Result, throwing the error if status is "error"
 */
export function unwrapResult<T>(result: Result<T, CommandError>): T {
  if (result.status === "error") {
    throw result.error;
  }
  return result.data;
}
