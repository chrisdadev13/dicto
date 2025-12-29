import { useQuery } from "@tanstack/react-query";
import type { Result, CommandError } from "@/bindings";
import type { TauriQueryOptions } from "./types";
import { unwrapResult } from "./utils";

/**
 * React Query wrapper for Tauri commands
 *
 * @example
 * const { data, isLoading, error } = useTauriQuery(
 *   ["notes", "list"],
 *   commands.notesList
 * );
 */
export function useTauriQuery<TData>(
  queryKey: readonly string[],
  commandFn: () => Promise<Result<TData, CommandError>>,
  options?: TauriQueryOptions
) {
  const query = useQuery<TData, CommandError>({
    queryKey,
    queryFn: async () => {
      const result = await commandFn();
      return unwrapResult(result);
    },
    enabled: options?.enabled,
    staleTime: options?.staleTime,
    refetchOnMount: options?.refetchOnMount,
    refetchInterval: options?.refetchInterval,
  });

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isLoading,
    isError: query.isError,
    isSuccess: query.isSuccess,
    isFetching: query.isFetching,
    isStale: query.isStale,
    refetch: query.refetch,
  };
}
