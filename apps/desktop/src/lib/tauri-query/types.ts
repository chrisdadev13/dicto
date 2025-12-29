import type { Result, CommandError } from "@/bindings";

// Re-export CommandError from bindings for convenience
export type { CommandError };

/**
 * Options for useTauriQuery
 */
export interface TauriQueryOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnMount?: boolean | "always";
  refetchInterval?: number | false;
}

/**
 * Options for useTauriMutation
 */
export interface TauriMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: CommandError, variables: TVariables) => void;
  /** Query keys to invalidate after successful mutation */
  invalidateKeys?: readonly (readonly string[])[];
}

/**
 * Generic command function type
 */
export type CommandFn<TData> = () => Promise<Result<TData, CommandError>>;

/**
 * Generic mutation function type
 */
export type MutationFn<TData, TVariables> = (
  variables: TVariables
) => Promise<Result<TData, CommandError>>;
